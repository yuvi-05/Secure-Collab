from functools import wraps
from flask import current_app, request
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from app.extensions import db
from app.models import User, WorkspaceMember, Channel, ChannelMember, CodingProject, ProjectMember
from app.models.workspace import (
    get_active_project_emergency_access,
    get_effective_project_role,
    get_effective_workspace_role,
)
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
    roles: optional list of required workspace roles
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
                user_id=current_user.id,
                is_active=True
            ).first()

            if not membership:
                return error_response("You are not a member of this workspace", 403)

            effective_role = get_effective_workspace_role(workspace_id, current_user.id)
            if effective_role == "guest" and request.method not in ("GET", "HEAD", "OPTIONS"):
                return error_response("Guests have read-only access to this workspace", 403)

            if roles and effective_role not in roles:
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
                user_id=current_user.id,
                is_active=True
            ).first()
            if not ws_membership:
                return error_response("You are not a member of this workspace", 403)

            effective_role = get_effective_workspace_role(channel.workspace_id, current_user.id)
            if effective_role == "guest" and request.method not in ("GET", "HEAD", "OPTIONS"):
                return error_response("Guests have read-only access to this workspace", 403)

            # Check channel membership if private or admin required
            ch_membership = ChannelMember.query.filter_by(
                channel_id=channel.id,
                user_id=current_user.id
            ).first()

            if channel.is_private and not ch_membership and effective_role != "owner":
                return error_response("You do not have access to this private channel", 403)

            if admin_only:
                if effective_role != "owner" and (not ch_membership or ch_membership.role != "admin"):
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
            if not project.is_active:
                return error_response("Project is inactive", 404)

            # Verify workspace membership
            ws_membership = WorkspaceMember.query.filter_by(
                workspace_id=project.workspace_id,
                user_id=current_user.id,
                is_active=True
            ).first()
            if not ws_membership:
                return error_response("You are not a member of this workspace", 403)

            project_role = get_effective_project_role(project.workspace_id, project.id, current_user.id)
            emergency_grant = get_active_project_emergency_access(
                project.workspace_id, project.id, current_user.id
            ) is not None
            # Verify project membership if restricted
            proj_member = ProjectMember.query.filter_by(
                project_id=project.id,
                user_id=current_user.id
            ).first()
            if project_role == "guest" and request.method not in ("GET", "HEAD", "OPTIONS"):
                return error_response("Guests have read-only access to this project", 403)

            if project_role in ["developer", "team_member", "guest"] and not proj_member and not emergency_grant:
                return error_response("This project has not been assigned to you", 403)

            if require_editor:
                can_edit = project_role in ["owner", "project_manager"] or (
                    project_role == "developer"
                    and proj_member
                    and proj_member.role in ["admin", "editor"]
                ) or emergency_grant
                if not can_edit:
                    return error_response("You have read-only access to this project", 403)

            if project_role == "guest" and not proj_member:
                return error_response("This project has not been shared with you", 403)

            return fn(*args, **kwargs)
        return wrapper
    return decorator


def project_manager_required():
    """Allow project-management actions only for workspace or scoped project managers."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            current_user = get_current_user()
            if not current_user:
                return error_response("Authentication required", 401)
            project_id = kwargs.get("project_id")
            project = db.session.get(CodingProject, project_id) if project_id else None
            if not project or not project.is_active:
                return error_response("Project not found", 404)
            role = get_effective_project_role(project.workspace_id, project.id, current_user.id)
            if role not in {"owner", "project_manager"}:
                return error_response("Project manager permissions required", 403)
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def super_admin_required():
    """Restrict platform workspace administration to the configured singleton identity."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            current_user = get_current_user()
            configured_email = current_app.config.get("SUPER_ADMIN_EMAIL", "")
            if (
                not current_user
                or not current_user.is_active
                or not current_user.is_super_admin
                or not configured_email
                or current_user.email.lower() != configured_email
            ):
                return error_response("Super Admin access required", 403)
            return fn(*args, **kwargs)
        return wrapper
    return decorator
