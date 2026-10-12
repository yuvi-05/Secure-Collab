import datetime
from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from app.extensions import db, socketio
from app.models import CodingProject, ProjectMember, ProjectFile, CollaborativeDocument, WorkspaceMember
from app.services.yjs_service import YjsService
from app.utils.response import success_response, error_response
from app.utils.security import sanitize_filepath, detect_language
from app.middleware.auth_middleware import get_current_user, workspace_member_required, project_access_required

projects_bp = Blueprint("projects", __name__, url_prefix="/api/workspaces/<int:workspace_id>/projects")

@projects_bp.route("", methods=["GET"])
@jwt_required()
@workspace_member_required()
def list_projects(workspace_id):
    projects = CodingProject.query.filter_by(workspace_id=workspace_id).order_by(CodingProject.updated_at.desc()).all()
    return success_response({"projects": [p.to_dict() for p in projects]})


@projects_bp.route("", methods=["POST"])
@jwt_required()
@workspace_member_required()
def create_project(workspace_id):
    current_user = get_current_user()
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    description = data.get("description", "").strip()

    if not name:
        return error_response("Project name is required", 400)

    project = CodingProject(
        workspace_id=workspace_id,
        name=name,
        description=description,
        created_by=current_user.id
    )
    db.session.add(project)
    db.session.flush()

    # Add creator as project admin
    member = ProjectMember(
        project_id=project.id,
        user_id=current_user.id,
        role="admin"
    )
    db.session.add(member)

    # Initialize a starter file (e.g., main.py or README.md)
    initial_file = ProjectFile(
        project_id=project.id,
        name="main.py",
        path="main.py",
        is_directory=False,
        language="python",
        content="# Welcome to Secure-Collab Real-Time Coding Workspace!\n\ndef main():\n    print(\"Hello, Secure-Collab!\")\n\nif __name__ == '__main__':\n    main()\n",
        updated_by=current_user.id
    )
    db.session.add(initial_file)

    db.session.commit()
    return success_response({"project": project.to_dict()}, "Project created successfully", 201)


@projects_bp.route("/<int:project_id>", methods=["GET"])
@jwt_required()
@project_access_required()
def get_project(workspace_id, project_id):
    project = CodingProject.query.filter_by(id=project_id, workspace_id=workspace_id).first()
    if not project:
        return error_response("Project not found", 404)

    files = ProjectFile.query.filter_by(project_id=project_id).order_by(ProjectFile.is_directory.desc(), ProjectFile.name.asc()).all()
    members = ProjectMember.query.filter_by(project_id=project_id).all()

    res = project.to_dict()
    res["files"] = [f.to_dict(include_content=False) for f in files]
    res["members"] = [m.to_dict() for m in members]
    return success_response({"project": res})


@projects_bp.route("/<int:project_id>/files", methods=["GET"])
@jwt_required()
@project_access_required()
def get_project_files(workspace_id, project_id):
    files = ProjectFile.query.filter_by(project_id=project_id).order_by(ProjectFile.is_directory.desc(), ProjectFile.path.asc()).all()
    return success_response({"files": [f.to_dict(include_content=False) for f in files]})


@projects_bp.route("/<int:project_id>/files", methods=["POST"])
@jwt_required()
@project_access_required(require_editor=True)
def create_project_file(workspace_id, project_id):
    current_user = get_current_user()
    data = request.get_json() or {}
    path = sanitize_filepath(data.get("path", "").strip())
    is_directory = bool(data.get("is_directory", False))
    content = data.get("content", "")

    if not path:
        return error_response("File path is required", 400)

    name = path.split("/")[-1]
    parent_path = "/".join(path.split("/")[:-1])

    existing = ProjectFile.query.filter_by(project_id=project_id, path=path).first()
    if existing:
        return error_response(f"Item '{path}' already exists", 409)

    language = "directory" if is_directory else detect_language(name)

    new_file = ProjectFile(
        project_id=project_id,
        name=name,
        path=path,
        is_directory=is_directory,
        content=content if not is_directory else "",
        language=language,
        parent_path=parent_path,
        updated_by=current_user.id
    )
    db.session.add(new_file)
    db.session.commit()

    file_dict = new_file.to_dict(include_content=True)
    # Broadcast file creation to project room
    socketio.emit("project_file_created", {"file": file_dict}, room=f"project_{project_id}")

    return success_response({"file": file_dict}, "File created successfully", 201)


@projects_bp.route("/<int:project_id>/files/<int:file_id>", methods=["GET"])
@jwt_required()
@project_access_required()
def get_file_content(workspace_id, project_id, file_id):
    pfile = ProjectFile.query.filter_by(id=file_id, project_id=project_id).first()
    if not pfile:
        return error_response("File not found", 404)

    return success_response({"file": pfile.to_dict(include_content=True)})


@projects_bp.route("/<int:project_id>/files/<int:file_id>", methods=["PUT"])
@jwt_required()
@project_access_required(require_editor=True)
def update_file(workspace_id, project_id, file_id):
    current_user = get_current_user()
    pfile = ProjectFile.query.filter_by(id=file_id, project_id=project_id).first()
    if not pfile:
        return error_response("File not found", 404)

    data = request.get_json() or {}
    
    # Handle rename
    if "path" in data and data["path"].strip():
        new_path = sanitize_filepath(data["path"].strip())
        if new_path != pfile.path:
            existing = ProjectFile.query.filter_by(project_id=project_id, path=new_path).first()
            if existing:
                return error_response("A file already exists with that path", 409)
            pfile.path = new_path
            pfile.name = new_path.split("/")[-1]
            pfile.parent_path = "/".join(new_path.split("/")[:-1])
            pfile.language = detect_language(pfile.name)

    # Handle content update
    if "content" in data and not pfile.is_directory:
        pfile.content = data["content"]
        pfile.updated_by = current_user.id
        pfile.updated_at = datetime.datetime.utcnow()

    db.session.commit()
    file_dict = pfile.to_dict(include_content=True)

    socketio.emit("project_file_updated", {"file": file_dict}, room=f"project_{project_id}")
    return success_response({"file": file_dict}, "File updated successfully")


@projects_bp.route("/<int:project_id>/files/<int:file_id>", methods=["DELETE"])
@jwt_required()
@project_access_required(require_editor=True)
def delete_file(workspace_id, project_id, file_id):
    pfile = ProjectFile.query.filter_by(id=file_id, project_id=project_id).first()
    if not pfile:
        return error_response("File not found", 404)

    # If directory, delete children
    if pfile.is_directory:
        children = ProjectFile.query.filter(
            ProjectFile.project_id == project_id,
            ProjectFile.path.startswith(f"{pfile.path}/")
        ).all()
        for child in children:
            # Delete any collaborative document state
            CollaborativeDocument.query.filter_by(file_id=child.id).delete()
            db.session.delete(child)

    CollaborativeDocument.query.filter_by(file_id=pfile.id).delete()
    db.session.delete(pfile)
    db.session.commit()

    socketio.emit("project_file_deleted", {"file_id": file_id}, room=f"project_{project_id}")
    return success_response(None, "File deleted successfully")


@projects_bp.route("/<int:project_id>/files/<int:file_id>/yjs-state", methods=["GET"])
@jwt_required()
@project_access_required()
def get_yjs_state(workspace_id, project_id, file_id):
    pfile = ProjectFile.query.filter_by(id=file_id, project_id=project_id).first()
    if not pfile:
        return error_response("File not found", 404)

    doc = YjsService.get_or_create_doc(project_id, file_id)
    return success_response({
        "file_id": file_id,
        "yjs_state": doc.yjs_state or "",
        "plaintext_content": pfile.content or "",
        "version": doc.version
    })


@projects_bp.route("/<int:project_id>/files/<int:file_id>/yjs-state", methods=["POST"])
@jwt_required()
@project_access_required(require_editor=True)
def save_yjs_state(workspace_id, project_id, file_id):
    current_user = get_current_user()
    data = request.get_json() or {}
    yjs_state = data.get("yjs_state", "")
    plaintext = data.get("plaintext_content")

    doc = YjsService.save_doc_state(
        file_id=file_id,
        yjs_state=yjs_state,
        plaintext_content=plaintext,
        user_id=current_user.id
    )

    return success_response({"version": doc.version, "updated_at": doc.updated_at.isoformat()})
