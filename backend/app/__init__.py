import os
from pathlib import Path
from flask import Flask, jsonify
from app.config import Config
from app.extensions import db, jwt, socketio, cors, migrate
from app.utils.response import error_response

def create_app(config_class=Config):
    flask_app = Flask(__name__)
    flask_app.config.from_object(config_class)

    # Ensure uploads directory exists
    Path(flask_app.config["UPLOAD_FOLDER"]).mkdir(parents=True, exist_ok=True)

    # Initialize extensions
    db.init_app(flask_app)
    jwt.init_app(flask_app)
    cors.init_app(flask_app, resources={r"/*": {"origins": "*"}})
    migrate.init_app(flask_app, db)
    socketio.init_app(flask_app)

    # Register socket event handlers
    with flask_app.app_context():
        import app.sockets  # Registers Socket.IO listeners

    # Register Blueprints
    from app.routes.auth import auth_bp
    from app.routes.workspaces import workspaces_bp
    from app.routes.channels import channels_bp
    from app.routes.messages import messages_bp
    from app.routes.files import files_bp
    from app.routes.projects import projects_bp
    from app.routes.ai import ai_bp
    from app.routes.notifications import notifications_bp

    flask_app.register_blueprint(auth_bp)
    flask_app.register_blueprint(workspaces_bp)
    flask_app.register_blueprint(channels_bp)
    flask_app.register_blueprint(messages_bp)
    flask_app.register_blueprint(files_bp)
    flask_app.register_blueprint(projects_bp)
    flask_app.register_blueprint(ai_bp)
    flask_app.register_blueprint(notifications_bp)

    # Health check route
    @flask_app.route("/api/health", methods=["GET"])
    def health_check():
        return jsonify({
            "status": "healthy",
            "service": "Secure-Collab Backend",
            "database": "connected",
            "ai_configured": bool(flask_app.config.get("OPENAI_API_KEY"))
        }), 200

    # Error Handlers
    @flask_app.errorhandler(404)
    def not_found_error(error):
        return error_response("Resource not found", 404)

    @flask_app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        return error_response("Internal server error", 500)

    @flask_app.errorhandler(413)
    def file_too_large(error):
        return error_response("File size exceeds 50MB limit", 413)

    # Create tables automatically for instant out-of-the-box readiness
    with flask_app.app_context():
        db.create_all()

    return flask_app
