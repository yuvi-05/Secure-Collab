from flask import current_app, request
from flask_socketio import emit, join_room, leave_room
from app.extensions import db, socketio
from app.models import CodingProject, ProjectFile, ProjectMember, User, WorkspaceMember
from app.models.workspace import get_active_project_emergency_access, get_effective_project_role
from app.sockets.presence_events import connected_users
from app.services.yjs_service import YjsService

# Track room collaborators: room -> { sid: user_info }
room_collaborators = {}

def _get_project_membership(project_id):
    user_id = connected_users.get(request.sid)
    if not user_id:
        return None, None
    project = db.session.get(CodingProject, project_id)
    if not project or not project.is_active:
        return None, None
    membership = WorkspaceMember.query.filter_by(
        workspace_id=project.workspace_id,
        user_id=user_id,
        is_active=True
    ).first()
    if not membership:
        return None, None
    effective_role = get_effective_project_role(project.workspace_id, project_id, user_id)
    project_member = ProjectMember.query.filter_by(
        project_id=project_id,
        user_id=user_id
    ).first()
    emergency_grant = get_active_project_emergency_access(
        project.workspace_id, project.id, user_id
    ) is not None
    if effective_role not in ["owner", "project_manager"] and not project_member and not emergency_grant:
        return None, None
    user = db.session.get(User, user_id)
    if not user or not user.is_active:
        return None, None

    return membership, user_id


@socketio.on("collab_join")
def handle_collab_join(data):
    project_id = data.get("project_id")
    file_id = data.get("file_id")

    if not project_id or not file_id:
        return

    try:
        project_id = int(project_id)
        file_id = int(file_id)
    except (TypeError, ValueError):
        emit("collab_error", {"message": "Invalid project or file"})
        return

    membership, user_id = _get_project_membership(project_id)
    project_file = db.session.get(ProjectFile, file_id)
    if not membership or not project_file or project_file.project_id != project_id:
        emit("collab_error", {"message": "You do not have access to this project file"})
        return

    user = db.session.get(User, user_id)
    if not user:
        emit("collab_error", {"message": "Authenticated user not found"})
        return

    room = f"collab_{project_id}_{file_id}"
    join_room(room)

    if room not in room_collaborators:
        room_collaborators[room] = {}

    room_collaborators[room][request.sid] = {
        "user_id": user.id,
        "username": user.username,
        "full_name": user.full_name or user.username,
        "avatar_url": user.avatar_url or "",
        "color": data.get("color", "#6366f1")
    }

    # Emit updated list of active peers in this file room
    emit("collab_peers_update", {
        "room": room,
        "file_id": file_id,
        "peers": list(room_collaborators[room].values())
    }, room=room)


@socketio.on("collab_leave")
def handle_collab_leave(data):
    project_id = data.get("project_id")
    file_id = data.get("file_id")
    if not project_id or not file_id:
        return

    room = f"collab_{project_id}_{file_id}"
    if room not in room_collaborators or request.sid not in room_collaborators[room]:
        return
    leave_room(room)

    if room in room_collaborators:
        removed = room_collaborators[room].pop(request.sid, None)
        if removed:
            emit("collab_peers_update", {
                "room": room,
                "file_id": file_id,
                "peers": list(room_collaborators[room].values())
            }, room=room)


@socketio.on("yjs_sync_update")
def handle_yjs_sync_update(data):
    """
    Distributes Yjs CRDT updates to all peers in the room and persists latest state.
    """
    project_id = data.get("project_id")
    file_id = data.get("file_id")
    update = data.get("update")  # Base64-encoded Yjs update
    plaintext = data.get("plaintext")

    if not project_id or not file_id or not update:
        return

    try:
        project_id = int(project_id)
        file_id = int(file_id)
    except (TypeError, ValueError):
        emit("collab_error", {"message": "Invalid project or file"})
        return

    membership, user_id = _get_project_membership(project_id)
    project_file = db.session.get(ProjectFile, file_id)
    project = db.session.get(CodingProject, project_id)
    if not membership or not project or not project_file or project_file.project_id != project_id:
        emit("collab_error", {"message": "You do not have access to this project file"})
        return
    effective_role = get_effective_project_role(project.workspace_id, project.id, user_id)
    project_member = ProjectMember.query.filter_by(
        project_id=project_id,
        user_id=user_id
    ).first()
    emergency_grant = get_active_project_emergency_access(
        project.workspace_id, project.id, user_id
    ) is not None
    if effective_role not in ["owner", "project_manager"] and not emergency_grant and (
        effective_role != "developer" or not project_member or project_member.role not in ["admin", "editor"]
    ):
        emit("collab_error", {"message": "You do not have edit access to this project"})
        return

    room = f"collab_{project_id}_{file_id}"
    
    # Broadcast conflict-free CRDT update to other collaborators
    emit("yjs_sync_update", {
        "file_id": file_id,
        "update": update
    }, room=room, include_self=False)

    # Persist in DB
    try:
        YjsService.save_doc_state(
            file_id=int(file_id),
            yjs_state=update,
            plaintext_content=plaintext,
            user_id=user_id
        )
    except Exception:
        current_app.logger.exception("Failed to save collaborative project update")
        emit("collab_error", {"message": "Unable to save collaborative update"})


@socketio.on("yjs_awareness_update")
def handle_yjs_awareness_update(data):
    """
    Distributes Yjs awareness states (cursors, selections, and user labels).
    """
    project_id = data.get("project_id")
    file_id = data.get("file_id")
    awareness = data.get("awareness")

    if not project_id or not file_id or not awareness:
        return

    try:
        project_id = int(project_id)
        file_id = int(file_id)
    except (TypeError, ValueError):
        emit("collab_error", {"message": "Invalid project or file"})
        return

    membership, _ = _get_project_membership(project_id)
    project_file = db.session.get(ProjectFile, file_id)
    if not membership or not project_file or project_file.project_id != project_id:
        emit("collab_error", {"message": "You do not have access to this project file"})
        return

    room = f"collab_{project_id}_{file_id}"
    emit("yjs_awareness_update", {
        "file_id": file_id,
        "awareness": awareness
    }, room=room, include_self=False)
