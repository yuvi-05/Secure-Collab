from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from app.extensions import db
from app.models import AIConversation, AIMessage, CodingProject, ProjectFile
from app.services.ai_service import AIService
from app.utils.response import success_response, error_response
from app.middleware.auth_middleware import get_current_user, workspace_member_required

ai_bp = Blueprint("ai", __name__, url_prefix="/api/workspaces/<int:workspace_id>/ai")

@ai_bp.route("/conversations", methods=["GET"])
@jwt_required()
@workspace_member_required()
def list_ai_conversations(workspace_id):
    current_user = get_current_user()
    project_id = request.args.get("project_id", type=int)

    query = AIConversation.query.filter_by(workspace_id=workspace_id, user_id=current_user.id)
    if project_id:
        query = query.filter_by(project_id=project_id)

    conversations = query.order_by(AIConversation.updated_at.desc()).all()
    return success_response({"conversations": [c.to_dict(include_messages=False) for c in conversations]})


@ai_bp.route("/conversations/<int:conversation_id>", methods=["GET"])
@jwt_required()
@workspace_member_required()
def get_ai_conversation(workspace_id, conversation_id):
    current_user = get_current_user()
    conv = AIConversation.query.filter_by(id=conversation_id, workspace_id=workspace_id, user_id=current_user.id).first()
    if not conv:
        return error_response("AI conversation not found", 404)

    return success_response({"conversation": conv.to_dict(include_messages=True)})


@ai_bp.route("/chat", methods=["POST"])
@jwt_required()
@workspace_member_required()
def chat_with_ai(workspace_id):
    current_user = get_current_user()
    data = request.get_json() or {}

    prompt = data.get("prompt", "").strip()
    action = data.get("action", "custom")  # 'explain', 'debug', 'refactor', 'test', 'optimize', 'custom'
    code_context = data.get("code_context", "")
    filename = data.get("filename", "")
    language = data.get("language", "")
    project_id = int(data["project_id"]) if data.get("project_id") else None
    conversation_id = int(data["conversation_id"]) if data.get("conversation_id") else None
    include_project_context = bool(data.get("include_project_context", False))

    if not prompt and action == "custom":
        return error_response("Prompt is required", 400)

    # Prepare action-specific prompting if preset
    action_prompts = {
        "explain": f"Please explain what the following {language} code does in detail, breaking down logic and architecture:\n```{language}\n{code_context}\n```",
        "debug": f"Please analyze this code for bugs, logic errors, and security issues. Suggest fixes:\n```{language}\n{code_context}\n```\nUser notes: {prompt}",
        "refactor": f"Please refactor the following code to improve readability, maintainability, performance, and best practices. Return the full refactored code in a code fence:\n```{language}\n{code_context}\n```\nSpecific goal: {prompt or 'Improve code quality and structure.'}",
        "test": f"Please generate a comprehensive unit test suite for the following {language} code:\n```{language}\n{code_context}\n```",
        "optimize": f"Analyze performance bottlenecks and provide optimized code:\n```{language}\n{code_context}\n```"
    }

    effective_prompt = action_prompts.get(action, prompt)

    # Fetch other project files if requested and safe
    project_files_context = []
    if include_project_context and project_id:
        files = ProjectFile.query.filter(
            ProjectFile.project_id == project_id,
            ProjectFile.is_directory == False,
            ProjectFile.name != filename
        ).limit(3).all()
        for f in files:
            project_files_context.append({"path": f.path, "language": f.language, "content": f.content})

    # Find or create AIConversation
    conversation = None
    if conversation_id:
        conversation = AIConversation.query.filter_by(id=conversation_id, user_id=current_user.id).first()

    if not conversation:
        title_snippet = (prompt or action).replace("\n", " ")[:35]
        conversation = AIConversation(
            user_id=current_user.id,
            workspace_id=workspace_id,
            project_id=project_id,
            title=f"AI: {title_snippet}..." if len(title_snippet) >= 35 else f"AI: {title_snippet}"
        )
        db.session.add(conversation)
        db.session.flush()

    # Record user message
    user_msg = AIMessage(
        conversation_id=conversation.id,
        sender="user",
        content=prompt or f"Run {action} on {filename}",
        code_context=code_context if code_context else None
    )
    db.session.add(user_msg)

    # Call AI Service
    ai_result = AIService.ask(
        prompt=effective_prompt,
        code_context=code_context,
        filename=filename,
        language=language,
        project_files=project_files_context
    )

    # Record assistant message
    assistant_msg = AIMessage(
        conversation_id=conversation.id,
        sender="assistant",
        content=ai_result["content"],
        suggested_diff=ai_result.get("suggested_diff")
    )
    db.session.add(assistant_msg)
    db.session.commit()

    return success_response({
        "conversation_id": conversation.id,
        "message": assistant_msg.to_dict(),
        "provider": ai_result.get("provider"),
        "model": ai_result.get("model")
    })
