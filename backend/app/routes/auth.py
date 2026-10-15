import datetime
import secrets
import hmac
from flask import Blueprint, request
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from app.extensions import db
from app.models import User
from app.utils.response import success_response, error_response

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    full_name = data.get("full_name", "").strip()

    if not username or not email or not password:
        return error_response("Username, email, and password are required", 400)

    if len(password) < 6:
        return error_response("Password must be at least 6 characters", 400)

    if User.query.filter_by(username=username).first():
        return error_response("Username is already taken", 409)

    if User.query.filter_by(email=email).first():
        return error_response("Email is already registered", 409)
    if email and email == current_admin_email():
        return error_response("This email is reserved for Super Admin login", 409)

    user = User(
        username=username,
        email=email,
        full_name=full_name or username,
        is_online=True,
        last_seen=datetime.datetime.now(datetime.timezone.utc)
    )
    user.set_password(password)

    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    return success_response({
        "user": user.to_dict(include_private=True),
        "access_token": token
    }, "Registration successful", 201)


def current_admin_email():
    from flask import current_app
    return current_app.config.get("SUPER_ADMIN_EMAIL", "").strip().lower()


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    login_id = data.get("login_id") or data.get("email") or data.get("username")
    password = data.get("password", "")

    if not login_id or not password:
        return error_response("Email/Username and password are required", 400)

    login_id = login_id.strip()
    user = User.query.filter(
        (User.email == login_id.lower()) | (User.username == login_id)
    ).first()

    if login_id.lower() == current_admin_email() or (user and user.is_super_admin):
        return error_response("Use the Super Admin login option", 403)
    if not user or not user.check_password(password) or not user.is_active:
        return error_response("Invalid credentials", 401)

    user.is_online = True
    user.last_seen = datetime.datetime.now(datetime.timezone.utc)
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    return success_response({
        "user": user.to_dict(include_private=True),
        "access_token": token
    }, "Login successful")


@auth_bp.route("/super-admin/login", methods=["POST"])
def super_admin_login():
    from flask import current_app

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return error_response("A JSON request body is required", 400)
    email = current_app.config.get("SUPER_ADMIN_EMAIL", "").strip().lower()
    configured_password = current_app.config.get("SUPER_ADMIN_PASSWORD", "")
    login_id = data.get("email", "")
    password = data.get("password", "")
    if not email or not configured_password:
        return error_response("Super Admin credentials are not configured on the server", 503)
    if not isinstance(login_id, str) or not isinstance(password, str):
        return error_response("Email and password are required", 400)
    if not hmac.compare_digest(login_id.strip().lower(), email) or not hmac.compare_digest(
        password, configured_password
    ):
        return error_response("Invalid Super Admin credentials", 401)

    user = User.query.filter_by(email=email).first()
    if user and not user.is_super_admin:
        return error_response(
            "Configured Super Admin email belongs to a regular user; choose a dedicated email",
            409
        )
    if not user:
        base_username = "super-admin"
        username = base_username
        suffix = 1
        while User.query.filter_by(username=username).first():
            suffix += 1
            username = f"{base_username}-{suffix}"
        user = User(
            username=username,
            email=email,
            full_name="Super Admin",
            is_active=True,
            is_super_admin=True,
        )
        user.set_password(secrets.token_urlsafe(48))
        db.session.add(user)
    user.is_online = True
    user.last_seen = datetime.datetime.now(datetime.timezone.utc)
    db.session.commit()
    return success_response({
        "user": user.to_dict(include_private=True),
        "access_token": create_access_token(identity=str(user.id))
    }, "Super Admin login successful")


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_current_profile():
    user_id = get_jwt_identity()
    user = db.session.get(User, int(user_id))
    if not user:
        return error_response("User not found", 404)

    return success_response({"user": user.to_dict(include_private=True)})


@auth_bp.route("/profile", methods=["PUT"])
@jwt_required()
def update_profile():
    user_id = get_jwt_identity()
    user = db.session.get(User, int(user_id))
    if not user:
        return error_response("User not found", 404)

    data = request.get_json() or {}
    if "full_name" in data:
        user.full_name = data["full_name"].strip()
    if "bio" in data:
        user.bio = data["bio"].strip()
    if "avatar_url" in data:
        user.avatar_url = data["avatar_url"].strip()

    db.session.commit()
    return success_response({"user": user.to_dict(include_private=True)}, "Profile updated successfully")


@auth_bp.route("/users/search", methods=["GET"])
@jwt_required()
def search_users():
    query = request.args.get("q", "").strip()
    users_query = User.query.filter(User.is_active.is_(True))
    if not query:
        users = users_query.limit(20).all()
    else:
        users = users_query.filter(
            (User.username.ilike(f"%{query}%")) | 
            (User.email.ilike(f"%{query}%")) | 
            (User.full_name.ilike(f"%{query}%"))
        ).limit(20).all()

    return success_response({"users": [u.to_dict() for u in users]})


@auth_bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    user_id = get_jwt_identity()
    user = db.session.get(User, int(user_id))
    if user:
        user.is_online = False
        user.last_seen = datetime.datetime.now(datetime.timezone.utc)
        db.session.commit()
    return success_response(None, "Logged out successfully")
