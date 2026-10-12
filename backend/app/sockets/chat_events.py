from flask import request
from flask_socketio import emit, join_room, leave_room
from app.extensions import socketio

@socketio.on("join_room")
def handle_join_room(data):
    room = data.get("room")
    if room:
        join_room(room)
        # emit("room_joined", {"room": room, "sid": request.sid})

@socketio.on("leave_room")
def handle_leave_room(data):
    room = data.get("room")
    if room:
        leave_room(room)

@socketio.on("typing_start")
def handle_typing_start(data):
    room = data.get("room")
    username = data.get("username")
    user_id = data.get("user_id")
    if room and username:
        emit("user_typing", {"room": room, "username": username, "user_id": user_id}, room=room, include_self=False)

@socketio.on("typing_stop")
def handle_typing_stop(data):
    room = data.get("room")
    username = data.get("username")
    user_id = data.get("user_id")
    if room and username:
        emit("user_stopped_typing", {"room": room, "username": username, "user_id": user_id}, room=room, include_self=False)
