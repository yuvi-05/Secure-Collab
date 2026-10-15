import datetime
import json
import uuid
import re
from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import and_, or_
from app.extensions import db, socketio
from app.models import (
    Workspace, WorkspaceMember, Channel, ChannelMember, Invitation, User,
    Notification, EmergencyAccessRequest, WorkspaceSetting, WorkspaceAuditLog,
    CodingProject, EmergencyAccessProject
)
from app.models.workspace import (
    ASSIGNABLE_WORKSPACE_ROLES,
    get_active_emergency_access,
    get_effective_workspace_role
)
from app.utils.datetime_utils import utc_now
from app.utils.response import success_response, error_response
from app.middleware.auth_middleware import (
    get_current_user,
    super_admin_required,
    workspace_member_required,
)

workspaces_bp = Blueprint("workspaces", __name__, url_prefix="/api/workspaces")


def _record_workspace_audit(workspace_id, actor_id, action, target_type, target_id, details=None):
    db.session.add(WorkspaceAuditLog(
        workspace_id=workspace_id,
        actor_id=actor_id,
        action=action,
        target_type=target_type,
        target_id=str(target_id),
        details=json.dumps(details or {})
    ))


def slugify(name: str) -> str:
    slug = re.sub(r'[^a-zA-Z0-9]+', '-', name).strip('-').lower()
    return f"{slug}-{uuid.uuid4().hex[:6]}"

@workspaces_bp.route("", methods=["GET"])
@jwt_required()
def list_my_workspaces():
    current_user = get_current_user()
    memberships = WorkspaceMember.query.filter_by(user_id=current_user.id, is_active=True).all()
    workspaces = []
    for m in memberships:
        ws_data = m.workspace.to_dict()
        ws_data["my_role"] = m.role
        workspaces.append(ws_data)

    return success_response({"workspaces": workspaces})


@workspaces_bp.route("", methods=["POST"])
@jwt_required()
@super_admin_required()
def create_workspace():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return error_response("A JSON request body is required", 400)
    name = data.get("name")
    description = data.get("description", "")
    owner_id = data.get("owner_id")

    if not isinstance(name, str) or not name.strip():
        return error_response("Workspace name is required", 400)
    if not isinstance(description, str):
        return error_response("Workspace description must be text", 400)
    if isinstance(owner_id, bool) or not isinstance(owner_id, int):
        return error_response("A valid workspace owner is required", 400)
    owner = db.session.get(User, owner_id)
    if not owner or not owner.is_active or owner.is_super_admin:
        return error_response("Workspace owner must be an active regular user", 400)

    slug = slugify(name)
    workspace = Workspace(
        name=name.strip(),
        slug=slug,
        description=description.strip(),
        owner_id=owner.id
    )
    db.session.add(workspace)
    db.session.flush()

    # Add owner as workspace member
    owner_member = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=owner.id,
        role="owner"
    )
    db.session.add(owner_member)

    # Automatically create default #general channel
    general_channel = Channel(
        workspace_id=workspace.id,
        name="general",
        topic="General discussion for the team",
        description="Company-wide announcements and team chat",
        is_private=False,
        created_by=owner.id
    )
    db.session.add(general_channel)
    db.session.flush()

    # Add owner to #general
    channel_member = ChannelMember(
        channel_id=general_channel.id,
        user_id=owner.id,
        role="admin"
    )
    db.session.add(channel_member)

    db.session.commit()

    return success_response({"workspace": workspace.to_dict()}, "Workspace created successfully", 201)


@workspaces_bp.route("/admin/workspaces", methods=["GET"])
@jwt_required()
@super_admin_required()
def list_all_workspaces():
    workspaces = Workspace.query.order_by(Workspace.created_at.desc()).all()
    return success_response({"workspaces": [
        {**workspace.to_dict(), "owner": workspace.owner.to_dict() if workspace.owner else None}
        for workspace in workspaces
    ]})


@workspaces_bp.route("/admin/users", methods=["GET"])
@jwt_required()
@super_admin_required()
def list_workspace_owner_candidates():
    users = User.query.filter(
        User.is_active.is_(True),
        User.is_super_admin.is_(False)
    ).order_by(User.full_name.asc(), User.username.asc()).all()
    return success_response({"users": [user.to_dict() for user in users]})


@workspaces_bp.route("/<int:workspace_id>/owner", methods=["PUT"])
@jwt_required()
@super_admin_required()
def transfer_workspace_owner(workspace_id):
    data = request.get_json(silent=True)
    owner_id = data.get("owner_id") if isinstance(data, dict) else None
    if isinstance(owner_id, bool) or not isinstance(owner_id, int):
        return error_response("A valid workspace owner is required", 400)
    workspace = db.session.get(Workspace, workspace_id)
    if not workspace:
        return error_response("Workspace not found", 404)
    new_owner = db.session.get(User, owner_id)
    if not new_owner or not new_owner.is_active or new_owner.is_super_admin:
        return error_response("Workspace owner must be an active regular user", 400)

    previous_owner_id = workspace.owner_id
    previous_owner_memberships = WorkspaceMember.query.filter_by(
        workspace_id=workspace_id, role="owner"
    ).all()
    for membership in previous_owner_memberships:
        if membership.user_id != new_owner.id:
            membership.role = "team_member"
    owner_membership = WorkspaceMember.query.filter_by(
        workspace_id=workspace_id, user_id=new_owner.id
    ).first()
    if owner_membership:
        owner_membership.role = "owner"
        owner_membership.is_active = True
    else:
        owner_membership = WorkspaceMember(
            workspace_id=workspace_id, user_id=new_owner.id, role="owner"
        )
        db.session.add(owner_membership)
    workspace.owner_id = new_owner.id

    if previous_owner_id != new_owner.id:
        channel_ids = [
            channel.id for channel in Channel.query.filter_by(workspace_id=workspace_id).all()
        ]
        previous_channel_memberships = ChannelMember.query.filter(
            ChannelMember.channel_id.in_(channel_ids),
            ChannelMember.user_id == previous_owner_id,
            ChannelMember.role == "admin"
        ).all()
        for channel_membership in previous_channel_memberships:
            channel_membership.role = "member"

    for channel in Channel.query.filter_by(workspace_id=workspace_id, is_private=False).all():
        channel_member = ChannelMember.query.filter_by(
            channel_id=channel.id, user_id=new_owner.id
        ).first()
        if not channel_member:
            db.session.add(ChannelMember(
                channel_id=channel.id, user_id=new_owner.id, role="admin"
            ))
        else:
            channel_member.role = "admin"
    current_user = get_current_user()
    _record_workspace_audit(
        workspace_id, current_user.id, "workspace.owner_transferred", "workspace",
        workspace_id, {"previous_owner_id": previous_owner_id, "owner_id": new_owner.id}
    )
    db.session.commit()
    return success_response(
        {"workspace": {**workspace.to_dict(), "owner": new_owner.to_dict()}},
        "Workspace owner updated"
    )


@workspaces_bp.route("/<int:workspace_id>", methods=["GET"])
@jwt_required()
@workspace_member_required()
def get_workspace_details(workspace_id):
    current_user = get_current_user()
    workspace = db.session.get(Workspace, workspace_id)
    if not workspace:
        return error_response("Workspace not found", 404)

    membership = WorkspaceMember.query.filter_by(workspace_id=workspace_id, user_id=current_user.id).first()
    res = workspace.to_dict()
    res["my_role"] = get_effective_workspace_role(workspace_id, current_user.id) or "team_member"
    active_access = get_active_emergency_access(workspace_id, current_user.id)
    res["my_emergency_access"] = active_access.to_dict() if active_access else None

    # Add channels accessible to user
    channels = []
    for ch in workspace.channels:
        if not ch.is_private:
            channels.append(ch.to_dict())
        else:
            # Check if user is in private channel
            ch_member = ChannelMember.query.filter_by(channel_id=ch.id, user_id=current_user.id).first()
            if ch_member or res["my_role"] == "owner":
                channels.append(ch.to_dict())

    res["channels"] = channels
    return success_response({"workspace": res})


@workspaces_bp.route("/<int:workspace_id>", methods=["PUT"])
@jwt_required()
@workspace_member_required(roles=["owner"])
def update_workspace(workspace_id):
    workspace = db.session.get(Workspace, workspace_id)
    data = request.get_json() or {}
    if "name" in data and data["name"].strip():
        workspace.name = data["name"].strip()
    if "description" in data:
        workspace.description = data["description"].strip()
    if "icon_url" in data:
        workspace.icon_url = data["icon_url"].strip()

    db.session.commit()
    return success_response({"workspace": workspace.to_dict()}, "Workspace updated successfully")


@workspaces_bp.route("/<int:workspace_id>", methods=["DELETE"])
@jwt_required()
@super_admin_required()
def delete_workspace(workspace_id):
    workspace = db.session.get(Workspace, workspace_id)
    if not workspace:
        return error_response("Workspace not found", 404)
    db.session.delete(workspace)
    db.session.commit()
    return success_response(None, "Workspace deleted successfully")


@workspaces_bp.route("/<int:workspace_id>/members", methods=["GET"])
@jwt_required()
@workspace_member_required()
def list_workspace_members(workspace_id):
    members = WorkspaceMember.query.filter_by(workspace_id=workspace_id).all()
    return success_response({"members": [m.to_dict() for m in members]})


@workspaces_bp.route("/<int:workspace_id>/members", methods=["POST"])
@jwt_required()
@workspace_member_required(roles=["owner"])
def add_member(workspace_id):
    current_user = get_current_user()
    data = request.get_json() or {}
    user_id = data.get("user_id")
    role = data.get("role", "team_member")

    if not isinstance(role, str) or role not in ASSIGNABLE_WORKSPACE_ROLES:
        return error_response("Invalid role specified", 400)

    if role == "project_manager":
        current_membership = WorkspaceMember.query.filter_by(
            workspace_id=workspace_id,
            user_id=current_user.id
        ).first()
        if current_membership.role != "owner":
            return error_response("Only the workspace owner can assign project manager roles", 403)

    if not user_id:
        return error_response("User ID is required", 400)

    user = db.session.get(User, int(user_id))
    if not user:
        return error_response("User not found", 404)

    existing = WorkspaceMember.query.filter_by(workspace_id=workspace_id, user_id=user.id).first()
    if existing:
        return error_response("User is already a member of this workspace", 400)

    member = WorkspaceMember(
        workspace_id=workspace_id,
        user_id=user.id,
        role=role
    )
    db.session.add(member)

    # Add to public channels
    public_channels = Channel.query.filter_by(workspace_id=workspace_id, is_private=False).all()
    for ch in public_channels:
        db.session.add(ChannelMember(channel_id=ch.id, user_id=user.id, role="member"))

    _record_workspace_audit(
        workspace_id, current_user.id, "member.added", "member", user.id,
        {"role": role}
    )
    db.session.commit()
    return success_response({"member": member.to_dict()}, "Member added successfully", 201)


@workspaces_bp.route("/<int:workspace_id>/members/<int:user_id>", methods=["PUT"])
@jwt_required()
@workspace_member_required(roles=["owner"])
def update_member_role(workspace_id, user_id):
    current_user = get_current_user()
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or not data or set(data) - {"role", "is_active"}:
        return error_response("Only role and is_active can be updated", 400)
    if "is_active" in data and not isinstance(data["is_active"], bool):
        return error_response("is_active must be a boolean", 400)

    membership = WorkspaceMember.query.filter_by(workspace_id=workspace_id, user_id=user_id).first()
    if not membership:
        return error_response("Member not found", 404)
    role = data.get("role", membership.role)
    if not isinstance(role, str) or role not in ASSIGNABLE_WORKSPACE_ROLES:
        return error_response("Invalid role specified", 400)

    if membership.role == "owner":
        return error_response("Cannot change role of workspace owner", 400)

    membership.role = role or membership.role
    if "is_active" in data:
        if membership.role == "owner" and not data["is_active"]:
            return error_response("Workspace owners cannot be deactivated", 400)
        if membership.user_id == current_user.id and not data["is_active"]:
            return error_response("You cannot deactivate your own workspace access", 400)
        if not data["is_active"] and membership.is_active:
            active_owners = WorkspaceMember.query.filter_by(
                workspace_id=workspace_id, role="owner", is_active=True
            ).count()
            if active_owners < 1:
                return error_response("A workspace must retain at least one active owner", 400)
        membership.is_active = data["is_active"]
    _record_workspace_audit(
        workspace_id, current_user.id, "member.updated", "member", user_id,
        {"role": membership.role, "is_active": membership.is_active}
    )
    db.session.commit()
    return success_response({"member": membership.to_dict()}, "Member role updated")


@workspaces_bp.route("/<int:workspace_id>/admin", methods=["GET"])
@jwt_required()
@workspace_member_required(roles=["owner"])
def get_workspace_admin_summary(workspace_id):
    projects = CodingProject.query.filter_by(workspace_id=workspace_id).order_by(CodingProject.name).all()
    setting = WorkspaceSetting.query.filter_by(
        workspace_id=workspace_id, key="emergency_access_max_hours"
    ).first()
    audit_logs = WorkspaceAuditLog.query.filter_by(workspace_id=workspace_id).order_by(
        WorkspaceAuditLog.created_at.desc()
    ).limit(100).all()
    return success_response({
        "projects": [{
            **project.to_dict(),
            "is_active": project.is_active
        } for project in projects],
        "emergency_access_max_hours": setting.value if setting else "unlimited",
        "audit_logs": [entry.to_dict() for entry in audit_logs]
    })


@workspaces_bp.route(
    "/<int:workspace_id>/admin/projects/<int:project_id>",
    methods=["PATCH"]
)
@jwt_required()
@workspace_member_required(roles=["owner"])
def update_workspace_project_status(workspace_id, project_id):
    current_user = get_current_user()
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or set(data) != {"is_active"} or not isinstance(data["is_active"], bool):
        return error_response("A boolean is_active value is required", 400)
    project = CodingProject.query.filter_by(id=project_id, workspace_id=workspace_id).first()
    if not project:
        return error_response("Project not found", 404)
    project.is_active = data["is_active"]
    _record_workspace_audit(
        workspace_id, current_user.id, "project.status_updated", "project", project.id,
        {"is_active": project.is_active}
    )
    db.session.commit()
    return success_response({"project": {**project.to_dict(), "is_active": project.is_active}})


@workspaces_bp.route(
    "/<int:workspace_id>/admin/emergency-access-policy",
    methods=["PUT"]
)
@jwt_required()
@workspace_member_required(roles=["owner"])
def update_workspace_emergency_policy(workspace_id):
    current_user = get_current_user()
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or set(data) != {"max_hours"}:
        return error_response("A max_hours value is required", 400)
    max_hours = data["max_hours"]
    if max_hours != "unlimited" and (
        isinstance(max_hours, bool) or not isinstance(max_hours, int) or not 1 <= max_hours <= 720
    ):
        return error_response("Maximum duration must be between 1 and 720 hours, or unlimited", 400)
    setting = WorkspaceSetting.query.filter_by(
        workspace_id=workspace_id, key="emergency_access_max_hours"
    ).first()
    if not setting:
        setting = WorkspaceSetting(
            workspace_id=workspace_id,
            key="emergency_access_max_hours",
            value=str(max_hours),
            updated_by=current_user.id
        )
        db.session.add(setting)
    else:
        setting.value = str(max_hours)
        setting.updated_by = current_user.id
    _record_workspace_audit(
        workspace_id, current_user.id, "emergency_access.policy_updated",
        "workspace", workspace_id, {"max_hours": str(max_hours)}
    )
    db.session.commit()
    return success_response({"max_hours": setting.value}, "Emergency access policy updated")


@workspaces_bp.route("/<int:workspace_id>/members/<int:user_id>", methods=["DELETE"])
@jwt_required()
@workspace_member_required(roles=["owner"])
def remove_member(workspace_id, user_id):
    current_user = get_current_user()
    membership = WorkspaceMember.query.filter_by(workspace_id=workspace_id, user_id=user_id).first()
    if not membership:
        return error_response("Member not found", 404)

    if membership.role == "owner":
        return error_response("Cannot remove workspace owner", 400)
    _record_workspace_audit(
        workspace_id, current_user.id, "member.removed", "member", user_id
    )
    db.session.delete(membership)
    db.session.commit()
    return success_response(None, "Member removed from workspace")


@workspaces_bp.route("/<int:workspace_id>/invitations", methods=["POST"])
@jwt_required()
@workspace_member_required(roles=["owner"])
def create_invitation(workspace_id):
    current_user = get_current_user()
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    role = data.get("role", "team_member")

    if not email:
        return error_response("Email address is required", 400)

    if not isinstance(role, str) or role not in ASSIGNABLE_WORKSPACE_ROLES:
        return error_response("Invalid role specified", 400)

    if role == "project_manager":
        current_membership = WorkspaceMember.query.filter_by(
            workspace_id=workspace_id,
            user_id=current_user.id
        ).first()
        if current_membership.role != "owner":
            return error_response("Only the workspace owner can invite project managers", 403)

    token = uuid.uuid4().hex
    invitation = Invitation(
        workspace_id=workspace_id,
        inviter_id=current_user.id,
        email=email,
        role=role,
        token=token
    )
    db.session.add(invitation)

    # Send in-app notification if user already exists
    target_user = User.query.filter_by(email=email).first()
    if target_user:
        ws = db.session.get(Workspace, workspace_id)
        notif = Notification(
            user_id=target_user.id,
            actor_id=current_user.id,
            workspace_id=workspace_id,
            type="invitation",
            title=f"Invitation to join {ws.name}",
            content=f"{current_user.username} invited you to join workspace '{ws.name}' as a {role}.",
            link=f"/invite/{token}"
        )
        db.session.add(notif)

    db.session.commit()
    return success_response({"invitation": invitation.to_dict()}, "Invitation created successfully", 201)


@workspaces_bp.route("/<int:workspace_id>/emergency-access", methods=["GET"])
@jwt_required()
@workspace_member_required()
def list_emergency_access_requests(workspace_id):
    current_user = get_current_user()
    membership = WorkspaceMember.query.filter_by(
        workspace_id=workspace_id,
        user_id=current_user.id,
        is_active=True
    ).first()
    query = EmergencyAccessRequest.query.filter_by(workspace_id=workspace_id)
    if membership.role != "owner":
        query = query.filter_by(requester_id=current_user.id)
    requests = query.order_by(EmergencyAccessRequest.created_at.desc()).all()
    return success_response({"requests": [item.to_dict() for item in requests]})


@workspaces_bp.route("/<int:workspace_id>/emergency-access/projects", methods=["GET"])
@jwt_required()
@workspace_member_required()
def list_emergency_access_projects(workspace_id):
    projects = CodingProject.query.filter_by(
        workspace_id=workspace_id,
        is_active=True
    ).order_by(CodingProject.name.asc()).all()
    return success_response({
        "projects": [{"id": project.id, "name": project.name} for project in projects]
    })


@workspaces_bp.route("/<int:workspace_id>/emergency-access", methods=["POST"])
@jwt_required()
def request_emergency_access(workspace_id):
    current_user = get_current_user()
    membership = WorkspaceMember.query.filter_by(
        workspace_id=workspace_id,
        user_id=current_user.id,
        is_active=True
    ).first()
    if not membership:
        return error_response("You are not a member of this workspace", 403)
    if membership.role in ["owner", "project_manager"]:
        return error_response("You already have project manager-level workspace access", 400)

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return error_response("A JSON request body is required", 400)
    reason = data.get("reason")
    if not isinstance(reason, str) or len(reason.strip()) < 10 or len(reason.strip()) > 2000:
        return error_response("Justification must be between 10 and 2000 characters", 400)
    requested_role = data.get("requested_role")
    if not isinstance(requested_role, str) or requested_role not in {"project_manager", "developer"}:
        return error_response("Temporary role must be project_manager or developer", 400)
    project_ids = data.get("project_ids")
    if (
        not isinstance(project_ids, list)
        or not project_ids
        or any(isinstance(project_id, bool) or not isinstance(project_id, int) for project_id in project_ids)
        or len(set(project_ids)) != len(project_ids)
    ):
        return error_response("Select one or more valid projects for temporary access", 400)
    projects = CodingProject.query.filter(
        CodingProject.workspace_id == workspace_id,
        CodingProject.is_active.is_(True),
        CodingProject.id.in_(project_ids)
    ).all()
    if len(projects) != len(project_ids):
        return error_response("Every selected project must be active and belong to this workspace", 400)

    now = utc_now().replace(tzinfo=None)
    existing = EmergencyAccessRequest.query.filter(
        EmergencyAccessRequest.workspace_id == workspace_id,
        EmergencyAccessRequest.requester_id == current_user.id,
        or_(
            EmergencyAccessRequest.status == "pending",
            and_(
                EmergencyAccessRequest.status == "approved",
                EmergencyAccessRequest.expires_at > now,
                EmergencyAccessRequest.revoked_at.is_(None)
            )
        )
    ).first()
    if existing:
        return error_response("You already have a pending request or active emergency access", 409)

    access_request = EmergencyAccessRequest(
        workspace_id=workspace_id,
        requester_id=current_user.id,
        reason=reason.strip(),
        requested_role=requested_role
    )
    db.session.add(access_request)
    db.session.flush()
    db.session.add_all([
        EmergencyAccessProject(request_id=access_request.id, project_id=project.id)
        for project in projects
    ])

    workspace = db.session.get(Workspace, workspace_id)
    project_names = ", ".join(project.name for project in projects)
    db.session.add(Notification(
        user_id=workspace.owner_id,
        actor_id=current_user.id,
        workspace_id=workspace_id,
        type="emergency_access_request",
        title=f"Emergency access requested for {workspace.name}",
        content=(
            f"{current_user.username} requested temporary {requested_role.replace('_', ' ')} "
            f"access to: {project_names}. Justification: {reason.strip()}"
        ),
        link=f"/workspaces/{workspace_id}/members"
    ))
    _record_workspace_audit(
        workspace_id, current_user.id, "emergency_access.requested",
        "emergency_access_request", access_request.id,
        {"requested_role": requested_role, "project_ids": project_ids}
    )
    db.session.commit()
    socketio.emit(
        "emergency_access_changed",
        {"workspace_id": workspace_id},
        room=f"user_{workspace.owner_id}"
    )
    return success_response(
        {"request": access_request.to_dict()},
        "Emergency access request submitted for owner approval",
        201
    )


@workspaces_bp.route(
    "/<int:workspace_id>/emergency-access/<int:request_id>/approve",
    methods=["POST"]
)
@jwt_required()
@workspace_member_required(roles=["owner"])
def approve_emergency_access(workspace_id, request_id):
    current_user = get_current_user()
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return error_response("A JSON request body is required", 400)
    duration_hours = data.get("duration_hours")
    if isinstance(duration_hours, bool) or not isinstance(duration_hours, int) or duration_hours < 1:
        return error_response("Access duration must be a positive whole number of hours", 400)
    max_duration_setting = WorkspaceSetting.query.filter_by(
        workspace_id=workspace_id, key="emergency_access_max_hours"
    ).first()
    if max_duration_setting and max_duration_setting.value != "unlimited":
        if duration_hours > int(max_duration_setting.value):
            return error_response(
                f"Access duration cannot exceed this workspace's limit of {max_duration_setting.value} hours",
                400
            )
    now = utc_now().replace(tzinfo=None)
    max_duration_hours = int((datetime.datetime.max - now).total_seconds() // 3600)
    if duration_hours > max_duration_hours:
        return error_response("Access duration exceeds the maximum supported expiry date", 400)

    access_request = EmergencyAccessRequest.query.filter_by(
        id=request_id,
        workspace_id=workspace_id
    ).first()
    if not access_request:
        return error_response("Emergency access request not found", 404)
    if access_request.status != "pending":
        return error_response("Only pending requests can be approved", 400)
    if access_request.requester_id == current_user.id:
        return error_response("You cannot approve your own request", 403)
    active_project_ids = {
        project.id for project in CodingProject.query.filter(
            CodingProject.workspace_id == workspace_id,
            CodingProject.is_active.is_(True),
            CodingProject.id.in_([grant.project_id for grant in access_request.project_grants])
        ).all()
    }
    if active_project_ids != {grant.project_id for grant in access_request.project_grants}:
        return error_response("One or more requested projects are no longer active", 400)

    access_request.status = "approved"
    access_request.reviewer_id = current_user.id
    access_request.reviewed_at = now
    access_request.expires_at = now + datetime.timedelta(hours=duration_hours)
    db.session.add(Notification(
        user_id=access_request.requester_id,
        actor_id=current_user.id,
        workspace_id=workspace_id,
        type="emergency_access_approved",
        title="Emergency access approved",
        content=f"Your temporary {access_request.requested_role.replace('_', ' ')} access is approved until {access_request.expires_at.isoformat()} UTC.",
        link=f"/workspaces/{workspace_id}/members"
    ))
    _record_workspace_audit(
        workspace_id, current_user.id, "emergency_access.approved",
        "emergency_access_request", access_request.id,
        {
            "requested_role": access_request.requested_role,
            "project_ids": [grant.project_id for grant in access_request.project_grants],
            "duration_hours": duration_hours
        }
    )
    db.session.commit()
    socketio.emit(
        "emergency_access_changed",
        {"workspace_id": workspace_id},
        room=f"user_{access_request.requester_id}"
    )
    return success_response({"request": access_request.to_dict()}, "Emergency access approved")


@workspaces_bp.route(
    "/<int:workspace_id>/emergency-access/<int:request_id>/deny",
    methods=["POST"]
)
@jwt_required()
@workspace_member_required(roles=["owner"])
def deny_emergency_access(workspace_id, request_id):
    current_user = get_current_user()
    access_request = EmergencyAccessRequest.query.filter_by(
        id=request_id,
        workspace_id=workspace_id
    ).first()
    if not access_request:
        return error_response("Emergency access request not found", 404)
    if access_request.status != "pending":
        return error_response("Only pending requests can be denied", 400)

    access_request.status = "denied"
    access_request.reviewer_id = current_user.id
    access_request.reviewed_at = utc_now().replace(tzinfo=None)
    db.session.add(Notification(
        user_id=access_request.requester_id,
        actor_id=current_user.id,
        workspace_id=workspace_id,
        type="emergency_access_denied",
        title="Emergency access request denied",
        content=f"Your request for temporary {access_request.requested_role.replace('_', ' ')} access was denied.",
        link=f"/workspaces/{workspace_id}/members"
    ))
    _record_workspace_audit(
        workspace_id, current_user.id, "emergency_access.denied",
        "emergency_access_request", access_request.id
    )
    db.session.commit()
    socketio.emit(
        "emergency_access_changed",
        {"workspace_id": workspace_id},
        room=f"user_{access_request.requester_id}"
    )
    return success_response({"request": access_request.to_dict()}, "Emergency access request denied")


@workspaces_bp.route(
    "/<int:workspace_id>/emergency-access/<int:request_id>",
    methods=["DELETE"]
)
@jwt_required()
def revoke_emergency_access(workspace_id, request_id):
    current_user = get_current_user()
    membership = WorkspaceMember.query.filter_by(
        workspace_id=workspace_id,
        user_id=current_user.id,
        is_active=True
    ).first()
    if not membership:
        return error_response("You are not a member of this workspace", 403)

    access_request = EmergencyAccessRequest.query.filter_by(
        id=request_id,
        workspace_id=workspace_id
    ).first()
    if not access_request:
        return error_response("Emergency access request not found", 404)
    if membership.role != "owner" and access_request.requester_id != current_user.id:
        return error_response("Only the workspace owner or access recipient can revoke this grant", 403)
    if not access_request.is_active:
        return error_response("Emergency access is not active", 400)

    now = utc_now().replace(tzinfo=None)
    access_request.revoked_at = now
    access_request.revoker_id = current_user.id
    access_request.status = "revoked"
    recipient_id = access_request.requester_id
    db.session.add(Notification(
        user_id=recipient_id,
        actor_id=current_user.id,
        workspace_id=workspace_id,
        type="emergency_access_revoked",
        title="Emergency access revoked",
        content=f"Temporary {access_request.requested_role.replace('_', ' ')} access has been revoked.",
        link=f"/workspaces/{workspace_id}/members"
    ))
    _record_workspace_audit(
        workspace_id, current_user.id, "emergency_access.revoked",
        "emergency_access_request", access_request.id
    )
    db.session.commit()
    socketio.emit(
        "emergency_access_changed",
        {"workspace_id": workspace_id},
        room=f"user_{recipient_id}"
    )
    return success_response({"request": access_request.to_dict()}, "Emergency access revoked")


@workspaces_bp.route("/join/<string:token>", methods=["POST"])
@jwt_required()
def join_workspace_via_token(token):
    current_user = get_current_user()
    invitation = Invitation.query.filter_by(token=token, status="pending").first()
    if not invitation:
        return error_response("Invitation is invalid or has expired", 404)

    # Check existing membership
    existing = WorkspaceMember.query.filter_by(workspace_id=invitation.workspace_id, user_id=current_user.id).first()
    if existing:
        invitation.status = "accepted"
        db.session.commit()
        return success_response({"workspace_id": invitation.workspace_id}, "You are already a member of this workspace")

    member = WorkspaceMember(
        workspace_id=invitation.workspace_id,
        user_id=current_user.id,
        role=invitation.role
    )
    db.session.add(member)
    invitation.status = "accepted"

    # Add to public channels
    public_channels = Channel.query.filter_by(workspace_id=invitation.workspace_id, is_private=False).all()
    for ch in public_channels:
        db.session.add(ChannelMember(channel_id=ch.id, user_id=current_user.id, role="member"))

    db.session.commit()
    return success_response({"workspace_id": invitation.workspace_id}, "Successfully joined workspace")
