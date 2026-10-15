from flask import request
from flask_socketio import emit, join_room, leave_room, rooms
from app.extensions import db, socketio
from app.models import Channel, ChannelMember, Conversation, ConversationMember, CodingProject, ProjectMember, User, WorkspaceMember
from app.models.workspace import (
    get_active_project_emergency_access,
    get_effective_project_role,
    get_effective_workspace_role,
)
from app.sockets.presence_events import connected_users


def _can_access_room(room):
    user_id = connected_users.get(request.sid)
    user = db.session.get(User, user_id) if user_id else None
    if not user or not user.is_active or not isinstance(room, str):
        return None

    try:
        prefix, raw_id = room.rsplit("_", 1)
        resource_id = int(raw_id)
    except (ValueError, AttributeError):
        return None

    if prefix == "workspace":
        membership = WorkspaceMember.query.filter_by(
            workspace_id=resource_id,
            user_id=user.id,
            is_active=True
        ).first()
        return (user, get_effective_workspace_role(resource_id, user.id)) if membership else None

    if prefix == "channel":
        channel = db.session.get(Channel, resource_id)
        if not channel:
            return None
        membership = WorkspaceMember.query.filter_by(
            workspace_id=channel.workspace_id,
            user_id=user.id,
            is_active=True
        ).first()
        if not membership:
            return None
        channel_membership = ChannelMember.query.filter_by(
            channel_id=channel.id,
            user_id=user.id
        ).first()
        role = get_effective_workspace_role(channel.workspace_id, user.id)
        if channel.is_private and not channel_membership and role != "owner":
            return None
        return user, role

    if prefix == "conversation":
        conversation = db.session.get(Conversation, resource_id)
        conversation_membership = ConversationMember.query.filter_by(
            conversation_id=resource_id,
            user_id=user.id
        ).first()
        if not conversation or not conversation_membership:
            return None
        workspace_membership = WorkspaceMember.query.filter_by(
            workspace_id=conversation.workspace_id,
            user_id=user.id,
            is_active=True
        ).first()
        if not workspace_membership:
            return None
        return user, get_effective_workspace_role(conversation.workspace_id, user.id)

    if prefix == "project":
        project = db.session.get(CodingProject, resource_id)
        if not project or not project.is_active:
            return None
        workspace_membership = WorkspaceMember.query.filter_by(
            workspace_id=project.workspace_id,
            user_id=user.id,
            is_active=True
        ).first()
        if not workspace_membership:
            return None
        role = get_effective_project_role(project.workspace_id, project.id, user.id)
        assigned = ProjectMember.query.filter_by(
            project_id=project.id,
            user_id=user.id
        ).first()
        emergency_grant = get_active_project_emergency_access(
            project.workspace_id, project.id, user.id
        ) is not None
        if role not in ["owner", "project_manager"] and not assigned and not emergency_grant:
            return None
        return user, role

    return None

@socketio.on("join_room")
def handle_join_room(data):
    room = data.get("room") if isinstance(data, dict) else None
    if _can_access_room(room):
        join_room(room)
    else:
        emit("socket_auth_error", {"message": "You do not have access to this room"})

@socketio.on("leave_room")
def handle_leave_room(data):
    room = data.get("room")
    if room:
        leave_room(room)

@socketio.on("typing_start")
def handle_typing_start(data):
    room = data.get("room") if isinstance(data, dict) else None
    access = _can_access_room(room)
    if access and room in rooms() and access[1] != "guest":
        user, _role = access
        emit("user_typing", {
            "room": room,
            "username": user.username,
            "user_id": user.id
        }, room=room, include_self=False)

@socketio.on("typing_stop")
def handle_typing_stop(data):
    room = data.get("room") if isinstance(data, dict) else None
    access = _can_access_room(room)
    if access and room in rooms() and access[1] != "guest":
        user, _role = access
        emit("user_stopped_typing", {
            "room": room,
            "username": user.username,
            "user_id": user.id
        }, room=room, include_self=False)
