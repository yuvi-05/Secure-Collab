from functools import wraps
from flask import request
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from app.extensions import db
from app.models import User, WorkspaceMember, Channel, ChannelMember, CodingProject, ProjectMember
from app.utils.response import error_response

def get_current_user():
    """Retrieve the User object corresponding to the current JWT identity."""
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return None
        return db.session.get(User, int(user_id))
    except Exception:
        return None

def workspace_member_required(roles=None):
    """
    Decorator to verify that the authenticated user belongs to the workspace.
    roles: optional list of required roles (e.g. ['owner', 'admin'])
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            current_user = get_current_user()
            if not current_user:
                return error_response("Authentication required", 401)

            workspace_id = kwargs.get("workspace_id")
            if not workspace_id and request.view_args:
                workspace_id = request.view_args.get("workspace_id")
            if not workspace_id and request.is_json and request.json:
                workspace_id = request.json.get("workspace_id")
            if not workspace_id:
                return error_response("Workspace ID is required", 400)

            try:
                workspace_id = int(workspace_id)
            except ValueError:
                return error_response("Invalid Workspace ID", 400)

            membership = WorkspaceMember.query.filter_by(
                workspace_id=workspace_id,
                user_id=current_user.id
            ).first()

            if not membership:
                return error_response("You are not a member of this workspace", 403)

            if roles and membership.role not in roles:
                return error_response(f"Insufficient permissions. Required roles: {', '.join(roles)}", 403)

            # Pass membership and user context in kwargs if desired or proceed
            return fn(*args, **kwargs)
        return wrapper
    return decorator

def channel_access_required(admin_only=False):
    """
    Decorator to verify access to a channel.
    If the channel is public, any workspace member can view it.
    If private, the user must be a member of the channel.
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            current_user = get_current_user()
            if not current_user:
                return error_response("Authentication required", 401)

            channel_id = kwargs.get("channel_id")
            if not channel_id:
                return error_response("Channel ID is required", 400)

            try:
                channel_id = int(channel_id)
            except ValueError:
                return error_response("Invalid Channel ID", 400)

            channel = db.session.get(Channel, channel_id)
            if not channel:
                return error_response("Channel not found", 404)

            # First verify workspace membership
            ws_membership = WorkspaceMember.query.filter_by(
                workspace_id=channel.workspace_id,
                user_id=current_user.id
            ).first()
            if not ws_membership:
                return error_response("You are not a member of this workspace", 403)

            # Check channel membership if private or admin required
            ch_membership = ChannelMember.query.filter_by(
                channel_id=channel.id,
                user_id=current_user.id
            ).first()

            if channel.is_private and not ch_membership and ws_membership.role != "owner":
                return error_response("You do not have access to this private channel", 403)

            if admin_only:
                if ws_membership.role not in ["owner", "admin"] and (not ch_membership or ch_membership.role != "admin"):
                    return error_response("Channel administrator permissions required", 403)

            return fn(*args, **kwargs)
        return wrapper
    return decorator

def project_access_required(require_editor=False):
    """Decorator to verify access to a coding project."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            current_user = get_current_user()
            if not current_user:
                return error_response("Authentication required", 401)

            project_id = kwargs.get("project_id")
            if not project_id:
                return error_response("Project ID is required", 400)

            project = db.session.get(CodingProject, int(project_id))
            if not project:
                return error_response("Project not found", 404)

            # Verify workspace membership
            ws_membership = WorkspaceMember.query.filter_by(
                workspace_id=project.workspace_id,
                user_id=current_user.id
            ).first()
            if not ws_membership:
                return error_response("You are not a member of this workspace", 403)

            # Verify project membership if restricted
            proj_member = ProjectMember.query.filter_by(
                project_id=project.id,
                user_id=current_user.id
            ).first()

            if require_editor and ws_membership.role not in ["owner", "admin"]:
                if proj_member and proj_member.role == "viewer":
                    return error_response("You have read-only access to this project", 403)

            return fn(*args, **kwargs)
        return wrapper
    return decorator
