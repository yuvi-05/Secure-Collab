import datetime
from flask import request
from flask_socketio import emit, join_room, leave_room
from flask_jwt_extended import decode_token
from flask_jwt_extended.exceptions import JWTExtendedException
from app.extensions import socketio, db
from app.models import User

# In-memory mapping of active socket session to user ID
connected_users = {}


def disconnect_user_sockets(user_id):
    for sid, connected_user_id in list(connected_users.items()):
        if connected_user_id == user_id:
            connected_users.pop(sid, None)
            socketio.server.disconnect(sid, namespace="/")
    user = db.session.get(User, user_id)
    if user:
        user.is_online = False
        user.last_seen = datetime.datetime.now(datetime.timezone.utc)


@socketio.on("connect")
def handle_connect():
    pass

@socketio.on("authenticate_socket")
def handle_authenticate_socket(data):
    previous_user_id = connected_users.pop(request.sid, None)
    if previous_user_id:
        leave_room(f"user_{previous_user_id}")

    token = data.get("token") if isinstance(data, dict) else None
    if not token:
        emit("socket_auth_error", {"message": "Authentication token is required"})
        return

    try:
        identity = decode_token(token).get("sub")
        uid = int(identity)
    except (TypeError, ValueError):
        emit("socket_auth_error", {"message": "Invalid authentication token"})
        return
    except JWTExtendedException:
        emit("socket_auth_error", {"message": "Invalid or expired authentication token"})
        return

    user = db.session.get(User, uid)
    if not user or not user.is_active:
        emit("socket_auth_error", {"message": "Authenticated user not found"})
        return

    connected_users[request.sid] = uid
    join_room(f"user_{uid}")
    user.is_online = True
    user.last_seen = datetime.datetime.now(datetime.timezone.utc)
    db.session.commit()
    emit("user_presence_change", {"user_id": uid, "is_online": True}, broadcast=True)

@socketio.on("disconnect")
def handle_disconnect():
    user_id = connected_users.pop(request.sid, None)
    if user_id:
        # Check if user has other active connections
        if user_id not in connected_users.values():
            try:
                user = db.session.get(User, user_id)
                if user:
                    user.is_online = False
                    user.last_seen = datetime.datetime.now(datetime.timezone.utc)
                    db.session.commit()
                    emit("user_presence_change", {"user_id": user_id, "is_online": False}, broadcast=True)
            except Exception:
                pass
