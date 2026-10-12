import uuid
import re
from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models import Workspace, WorkspaceMember, Channel, ChannelMember, Invitation, User, Notification
from app.utils.response import success_response, error_response
from app.middleware.auth_middleware import get_current_user, workspace_member_required

workspaces_bp = Blueprint("workspaces", __name__, url_prefix="/api/workspaces")

def slugify(name: str) -> str:
    slug = re.sub(r'[^a-zA-Z0-9]+', '-', name).strip('-').lower()
    return f"{slug}-{uuid.uuid4().hex[:6]}"

@workspaces_bp.route("", methods=["GET"])
@jwt_required()
def list_my_workspaces():
    current_user = get_current_user()
    memberships = WorkspaceMember.query.filter_by(user_id=current_user.id).all()
    workspaces = []
    for m in memberships:
        ws_data = m.workspace.to_dict()
        ws_data["my_role"] = m.role
        workspaces.append(ws_data)

    return success_response({"workspaces": workspaces})


@workspaces_bp.route("", methods=["POST"])
@jwt_required()
def create_workspace():
    current_user = get_current_user()
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    description = data.get("description", "").strip()

    if not name:
        return error_response("Workspace name is required", 400)

    slug = slugify(name)
    workspace = Workspace(
        name=name,
        slug=slug,
        description=description,
        owner_id=current_user.id
    )
    db.session.add(workspace)
    db.session.flush()

    # Add owner as workspace member
    owner_member = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=current_user.id,
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
        created_by=current_user.id
    )
    db.session.add(general_channel)
    db.session.flush()

    # Add owner to #general
    channel_member = ChannelMember(
        channel_id=general_channel.id,
        user_id=current_user.id,
        role="admin"
    )
    db.session.add(channel_member)

    db.session.commit()

    res = workspace.to_dict()
    res["my_role"] = "owner"
    return success_response({"workspace": res}, "Workspace created successfully", 201)


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
    res["my_role"] = membership.role if membership else "member"

    # Add channels accessible to user
    channels = []
    for ch in workspace.channels:
        if not ch.is_private:
            channels.append(ch.to_dict())
        else:
            # Check if user is in private channel
            ch_member = ChannelMember.query.filter_by(channel_id=ch.id, user_id=current_user.id).first()
            if ch_member or membership.role in ["owner", "admin"]:
                channels.append(ch.to_dict())

    res["channels"] = channels
    return success_response({"workspace": res})


@workspaces_bp.route("/<int:workspace_id>", methods=["PUT"])
@jwt_required()
@workspace_member_required(roles=["owner", "admin"])
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
@workspace_member_required(roles=["owner"])
def delete_workspace(workspace_id):
    workspace = db.session.get(Workspace, workspace_id)
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
@workspace_member_required(roles=["owner", "admin"])
def add_member(workspace_id):
    data = request.get_json() or {}
    user_id = data.get("user_id")
    role = data.get("role", "member")

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
        role=role if role in ["admin", "member"] else "member"
    )
    db.session.add(member)

    # Add to public channels
    public_channels = Channel.query.filter_by(workspace_id=workspace_id, is_private=False).all()
    for ch in public_channels:
        db.session.add(ChannelMember(channel_id=ch.id, user_id=user.id, role="member"))

    db.session.commit()
    return success_response({"member": member.to_dict()}, "Member added successfully", 201)


@workspaces_bp.route("/<int:workspace_id>/members/<int:user_id>", methods=["PUT"])
@jwt_required()
@workspace_member_required(roles=["owner"])
def update_member_role(workspace_id, user_id):
    data = request.get_json() or {}
    role = data.get("role")
    if role not in ["admin", "member"]:
        return error_response("Invalid role specified", 400)

    membership = WorkspaceMember.query.filter_by(workspace_id=workspace_id, user_id=user_id).first()
    if not membership:
        return error_response("Member not found", 404)

    if membership.role == "owner":
        return error_response("Cannot change role of workspace owner", 400)

    membership.role = role
    db.session.commit()
    return success_response({"member": membership.to_dict()}, "Member role updated")


@workspaces_bp.route("/<int:workspace_id>/members/<int:user_id>", methods=["DELETE"])
@jwt_required()
@workspace_member_required(roles=["owner", "admin"])
def remove_member(workspace_id, user_id):
    current_user = get_current_user()
    membership = WorkspaceMember.query.filter_by(workspace_id=workspace_id, user_id=user_id).first()
    if not membership:
        return error_response("Member not found", 404)

    if membership.role == "owner":
        return error_response("Cannot remove workspace owner", 400)

    # Prevent admin from kicking another admin unless owner
    my_membership = WorkspaceMember.query.filter_by(workspace_id=workspace_id, user_id=current_user.id).first()
    if my_membership.role != "owner" and membership.role == "admin" and user_id != current_user.id:
        return error_response("Only the workspace owner can remove administrators", 403)

    db.session.delete(membership)
    db.session.commit()
    return success_response(None, "Member removed from workspace")


@workspaces_bp.route("/<int:workspace_id>/invitations", methods=["POST"])
@jwt_required()
@workspace_member_required(roles=["owner", "admin"])
def create_invitation(workspace_id):
    current_user = get_current_user()
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    role = data.get("role", "member")

    if not email:
        return error_response("Email address is required", 400)

    token = uuid.uuid4().hex
    invitation = Invitation(
        workspace_id=workspace_id,
        inviter_id=current_user.id,
        email=email,
        role=role if role in ["admin", "member"] else "member",
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
