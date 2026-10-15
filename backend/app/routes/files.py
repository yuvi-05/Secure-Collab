import mimetypes
from flask import Blueprint, request, send_file
from flask_jwt_extended import jwt_required
from app.extensions import db
from app.models import FileAttachment, WorkspaceMember
from app.services.file_service import FileService
from app.utils.response import success_response, error_response
from app.middleware.auth_middleware import get_current_user, workspace_member_required
from app.models.workspace import get_effective_workspace_role

files_bp = Blueprint("files", __name__, url_prefix="/api/workspaces/<int:workspace_id>/files")

@files_bp.route("/upload", methods=["POST"])
@jwt_required()
@workspace_member_required()
def upload_file(workspace_id):
    current_user = get_current_user()
    if "file" not in request.files:
        return error_response("No file provided in form-data", 400)

    uploaded_file = request.files["file"]
    message_id = request.form.get("message_id", type=int)

    try:
        attachment = FileService.save_file(
            file=uploaded_file,
            workspace_id=workspace_id,
            user_id=current_user.id,
            message_id=message_id
        )
        return success_response({"file": attachment.to_dict()}, "File uploaded successfully", 201)
    except ValueError as ve:
        return error_response(str(ve), 400)
    except Exception as e:
        return error_response(f"Upload failed: {str(e)}", 500)


@files_bp.route("", methods=["GET"])
@jwt_required()
@workspace_member_required()
def list_files(workspace_id):
    query = request.args.get("q", "").strip()
    files_query = FileAttachment.query.filter_by(workspace_id=workspace_id)
    if query:
        files_query = files_query.filter(FileAttachment.filename.ilike(f"%{query}%"))

    files = files_query.order_by(FileAttachment.id.desc()).limit(50).all()
    return success_response({"files": [f.to_dict() for f in files]})


@files_bp.route("/<int:file_id>/download", methods=["GET"])
@jwt_required()
@workspace_member_required()
def download_file(workspace_id, file_id):
    attachment = FileAttachment.query.filter_by(id=file_id, workspace_id=workspace_id).first()
    if not attachment:
        return error_response("File not found", 404)

    try:
        file_path = FileService.get_file_path(attachment)
        return send_file(
            str(file_path),
            as_attachment=True,
            download_name=attachment.filename,
            mimetype=attachment.content_type
        )
    except Exception as e:
        return error_response(f"Unable to read file: {str(e)}", 404)


@files_bp.route("/<int:file_id>/preview", methods=["GET"])
@jwt_required()
@workspace_member_required()
def preview_file(workspace_id, file_id):
    attachment = FileAttachment.query.filter_by(id=file_id, workspace_id=workspace_id).first()
    if not attachment:
        return error_response("File not found", 404)

    try:
        file_path = FileService.get_file_path(attachment)
        mime = attachment.content_type or mimetypes.guess_type(attachment.filename)[0] or "application/octet-stream"
        return send_file(
            str(file_path),
            as_attachment=False,
            mimetype=mime
        )
    except Exception as e:
        return error_response(f"Preview unavailable: {str(e)}", 404)


@files_bp.route("/<int:file_id>", methods=["DELETE"])
@jwt_required()
@workspace_member_required()
def delete_file(workspace_id, file_id):
    current_user = get_current_user()
    attachment = FileAttachment.query.filter_by(id=file_id, workspace_id=workspace_id).first()
    if not attachment:
        return error_response("File not found", 404)

    ws_membership = WorkspaceMember.query.filter_by(workspace_id=workspace_id, user_id=current_user.id).first()
    if attachment.user_id != current_user.id and get_effective_workspace_role(
        workspace_id, current_user.id
    ) != "owner":
        return error_response("Permission denied to delete this file", 403)

    try:
        path = FileService.get_file_path(attachment)
        if path.exists():
            path.unlink()
    except Exception:
        pass

    db.session.delete(attachment)
    db.session.commit()
    return success_response(None, "File deleted successfully")
