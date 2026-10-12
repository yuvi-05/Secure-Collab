# Import socket event handlers so they register with socketio
from app.sockets import chat_events, presence_events, collab_events

__all__ = ["chat_events", "presence_events", "collab_events"]
