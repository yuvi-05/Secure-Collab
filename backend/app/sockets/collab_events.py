from flask import request
from flask_socketio import emit, join_room, leave_room
from app.extensions import socketio
from app.services.yjs_service import YjsService

# Track room collaborators: room -> { sid: user_info }
room_collaborators = {}

@socketio.on("collab_join")
def handle_collab_join(data):
    project_id = data.get("project_id")
    file_id = data.get("file_id")
    user = data.get("user", {})

    if not project_id or not file_id:
        return

    room = f"collab_{project_id}_{file_id}"
    join_room(room)

    if room not in room_collaborators:
        room_collaborators[room] = {}

    room_collaborators[room][request.sid] = {
        "user_id": user.get("id"),
        "username": user.get("username", "Anonymous"),
        "full_name": user.get("full_name", user.get("username", "Anonymous")),
        "avatar_url": user.get("avatar_url", ""),
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
    user_id = data.get("user_id")

    if not project_id or not file_id or not update:
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
        pass


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

    room = f"collab_{project_id}_{file_id}"
    emit("yjs_awareness_update", {
        "file_id": file_id,
        "awareness": awareness
    }, room=room, include_self=False)
