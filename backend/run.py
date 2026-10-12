import os
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

from app import create_app
from app.extensions import socketio

app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    host = os.getenv("HOST", "0.0.0.0")
    print(f"[STARTING] Secure-Collab Backend running on http://{host}:{port}")
    socketio.run(app, host=host, port=port, debug=True, allow_unsafe_werkzeug=True)
