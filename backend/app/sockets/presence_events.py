import datetime
from flask import request
from flask_socketio import emit, join_room
from app.extensions import socketio, db
from app.models import User

# In-memory mapping of active socket session to user ID
connected_users = {}

@socketio.on("connect")
def handle_connect():
    pass

@socketio.on("authenticate_socket")
def handle_authenticate_socket(data):
    user_id = data.get("user_id")
    if user_id:
        try:
            uid = int(user_id)
            connected_users[request.sid] = uid
            join_room(f"user_{uid}")
            user = db.session.get(User, uid)
            if user:
                user.is_online = True
                user.last_seen = datetime.datetime.now(datetime.timezone.utc)
                db.session.commit()
                emit("user_presence_change", {"user_id": uid, "is_online": True}, broadcast=True)
        except Exception:
            pass

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
