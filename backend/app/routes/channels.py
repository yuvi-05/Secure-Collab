from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from app.extensions import db
from app.models import Channel, ChannelMember, WorkspaceMember, User
from app.utils.response import success_response, error_response
from app.middleware.auth_middleware import get_current_user, workspace_member_required, channel_access_required
from app.models.workspace import get_effective_workspace_role

channels_bp = Blueprint("channels", __name__, url_prefix="/api/workspaces/<int:workspace_id>/channels")

@channels_bp.route("", methods=["POST"])
@jwt_required()
@workspace_member_required(roles=["owner"])
def create_channel(workspace_id):
    current_user = get_current_user()
    data = request.get_json() or {}
    name = data.get("name", "").strip().lower().replace(" ", "-")
    topic = data.get("topic", "").strip()
    description = data.get("description", "").strip()
    is_private = bool(data.get("is_private", False))

    if not name:
        return error_response("Channel name is required", 400)

    existing = Channel.query.filter_by(workspace_id=workspace_id, name=name).first()
    if existing:
        return error_response(f"Channel #{name} already exists in this workspace", 409)

    channel = Channel(
        workspace_id=workspace_id,
        name=name,
        topic=topic,
        description=description,
        is_private=is_private,
        created_by=current_user.id
    )
    db.session.add(channel)
    db.session.flush()

    # Add creator as channel admin
    db.session.add(ChannelMember(channel_id=channel.id, user_id=current_user.id, role="admin"))

    # If public, add all existing workspace members automatically
    if not is_private:
        ws_members = WorkspaceMember.query.filter_by(workspace_id=workspace_id).all()
        for m in ws_members:
            if m.user_id != current_user.id:
                db.session.add(ChannelMember(channel_id=channel.id, user_id=m.user_id, role="member"))

    db.session.commit()
    return success_response({"channel": channel.to_dict()}, "Channel created successfully", 201)


@channels_bp.route("/<int:channel_id>", methods=["GET"])
@jwt_required()
@channel_access_required()
def get_channel(workspace_id, channel_id):
    channel = db.session.get(Channel, channel_id)
    return success_response({"channel": channel.to_dict()})


@channels_bp.route("/<int:channel_id>", methods=["PUT"])
@jwt_required()
@channel_access_required(admin_only=True)
def update_channel(workspace_id, channel_id):
    channel = db.session.get(Channel, channel_id)
    data = request.get_json() or {}
    
    if "name" in data and data["name"].strip():
        new_name = data["name"].strip().lower().replace(" ", "-")
        if channel.name == "general" and new_name != "general":
            return error_response("The default #general channel cannot be renamed", 400)
        existing = Channel.query.filter(Channel.workspace_id == workspace_id, Channel.name == new_name, Channel.id != channel.id).first()
        if existing:
            return error_response(f"Channel #{new_name} already exists", 409)
        channel.name = new_name

    if "topic" in data:
        channel.topic = data["topic"].strip()
    if "description" in data:
        channel.description = data["description"].strip()

    db.session.commit()
    return success_response({"channel": channel.to_dict()}, "Channel updated successfully")


@channels_bp.route("/<int:channel_id>", methods=["DELETE"])
@jwt_required()
@channel_access_required(admin_only=True)
def delete_channel(workspace_id, channel_id):
    channel = db.session.get(Channel, channel_id)
    if channel.name == "general":
        return error_response("The default #general channel cannot be deleted", 400)

    db.session.delete(channel)
    db.session.commit()
    return success_response(None, "Channel deleted successfully")


@channels_bp.route("/<int:channel_id>/members", methods=["GET"])
@jwt_required()
@channel_access_required()
def list_channel_members(workspace_id, channel_id):
    members = ChannelMember.query.filter_by(channel_id=channel_id).all()
    return success_response({"members": [m.to_dict() for m in members]})


@channels_bp.route("/<int:channel_id>/members", methods=["POST"])
@jwt_required()
@channel_access_required(admin_only=True)
def add_channel_member(workspace_id, channel_id):
    data = request.get_json() or {}
    user_id = data.get("user_id")
    if not user_id:
        return error_response("User ID is required", 400)

    # Verify user is a workspace member
    ws_member = WorkspaceMember.query.filter_by(workspace_id=workspace_id, user_id=user_id).first()
    if not ws_member:
        return error_response("User is not a member of this workspace", 400)

    existing = ChannelMember.query.filter_by(channel_id=channel_id, user_id=user_id).first()
    if existing:
        return error_response("User is already in this channel", 400)

    member = ChannelMember(channel_id=channel_id, user_id=user_id, role="member")
    db.session.add(member)
    db.session.commit()
    return success_response({"member": member.to_dict()}, "Member added to channel", 201)


@channels_bp.route("/<int:channel_id>/members/<int:user_id>", methods=["DELETE"])
@jwt_required()
@channel_access_required()
def remove_channel_member(workspace_id, channel_id, user_id):
    current_user = get_current_user()
    channel = db.session.get(Channel, channel_id)
    if channel.name == "general":
        return error_response("Members cannot be removed from #general channel", 400)

    target_membership = ChannelMember.query.filter_by(channel_id=channel_id, user_id=user_id).first()
    if not target_membership:
        return error_response("Member not in channel", 404)

    # Can leave oneself, or admin can remove
    if current_user.id != user_id:
        my_membership = ChannelMember.query.filter_by(channel_id=channel_id, user_id=current_user.id).first()
        ws_membership = WorkspaceMember.query.filter_by(workspace_id=workspace_id, user_id=current_user.id).first()
        if not my_membership or (
            my_membership.role != "admin"
            and get_effective_workspace_role(workspace_id, current_user.id) != "owner"
        ):
            return error_response("Permission denied to remove channel member", 403)

    db.session.delete(target_membership)
    db.session.commit()
    return success_response(None, "Member removed from channel")
