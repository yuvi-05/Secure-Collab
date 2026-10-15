import datetime
import re
from flask import Blueprint, current_app, request
from flask_jwt_extended import jwt_required
from app.extensions import db, socketio
from app.models import Message, MessageReaction, HiddenMessage, Channel, Conversation, ConversationMember, Workspace, WorkspaceMember, User, Notification, FileAttachment
from app.utils.response import success_response, error_response
from app.middleware.auth_middleware import get_current_user, workspace_member_required
from app.models.workspace import get_effective_workspace_role

messages_bp = Blueprint("messages", __name__, url_prefix="/api/workspaces/<int:workspace_id>")


def _message_expiry():
    return datetime.datetime.utcnow() + datetime.timedelta(
        seconds=current_app.config["CHAT_MESSAGE_TTL_SECONDS"]
    )


def _cleanup_expired_messages():
    expired_messages = Message.query.filter(
        Message.expires_at <= datetime.datetime.utcnow()
    ).all()
    if expired_messages:
        for message in expired_messages:
            db.session.delete(message)
        db.session.commit()


def _ensure_personal_conversation(workspace_id, participant_ids):
    conversation = Conversation.query.filter_by(
        workspace_id=workspace_id, is_group=False
    ).join(ConversationMember).group_by(Conversation.id).having(
        db.func.count(ConversationMember.id) == len(participant_ids)
    ).all()
    participant_set = set(participant_ids)
    for candidate in conversation:
        if {member.user_id for member in candidate.members} == participant_set:
            return candidate

    conversation = Conversation(workspace_id=workspace_id, is_group=False)
    db.session.add(conversation)
    db.session.flush()
    for user_id in participant_ids:
        db.session.add(ConversationMember(
            conversation_id=conversation.id, user_id=user_id
        ))
    return conversation


def _mirror_personal_message(source_workspace, conversation, message):
    if not source_workspace.is_personal or conversation.is_group:
        return
    participant_ids = [member.user_id for member in conversation.members]
    personal_workspaces = Workspace.query.filter(
        Workspace.is_personal.is_(True),
        Workspace.owner_id.in_(participant_ids),
        Workspace.id != source_workspace.id,
    ).all()
    for personal_workspace in personal_workspaces:
        mirrored_conversation = _ensure_personal_conversation(
            personal_workspace.id, participant_ids
        )
        mirrored_message = Message(
            workspace_id=personal_workspace.id,
            conversation_id=mirrored_conversation.id,
            user_id=message.user_id,
            content=message.content,
            source_message_id=message.id,
            expires_at=message.expires_at,
        )
        db.session.add(mirrored_message)
        db.session.flush()
        mirrored_dict = mirrored_message.to_dict(current_user_id=message.user_id)
        socketio.emit("message_new", mirrored_dict, room=f"conversation_{mirrored_conversation.id}")
        for participant_id in participant_ids:
            if participant_id != message.user_id:
                socketio.emit(
                    "dm_message_notification",
                    mirrored_dict,
                    room=f"user_{participant_id}",
                )
        socketio.emit(
            "conversation_new",
            {
                "workspace_id": personal_workspace.id,
                "conversation": mirrored_conversation.to_dict(
                    current_user_id=message.user_id
                ),
            },
            room=f"user_{personal_workspace.owner_id}",
        )


def _provision_personal_conversations(source_workspace, participant_ids):
    if not source_workspace.is_personal:
        return
    personal_workspaces = Workspace.query.filter(
        Workspace.is_personal.is_(True),
        Workspace.owner_id.in_(participant_ids),
    ).all()
    for personal_workspace in personal_workspaces:
        _ensure_personal_conversation(personal_workspace.id, participant_ids)

@messages_bp.route("/messages", methods=["GET"])
@jwt_required()
@workspace_member_required()
def get_messages(workspace_id):
    current_user = get_current_user()
    _cleanup_expired_messages()
    channel_id = request.args.get("channel_id", type=int)
    conversation_id = request.args.get("conversation_id", type=int)
    parent_id = request.args.get("parent_id", type=int)  # For thread replies
    limit = min(request.args.get("limit", 50, type=int), 100)
    before_id = request.args.get("before_id", type=int)

    hidden_ids = db.session.query(HiddenMessage.message_id).filter_by(user_id=current_user.id)
    query = Message.query.filter(
        Message.workspace_id == workspace_id,
        ~Message.id.in_(hidden_ids),
    )

    if parent_id is not None:
        query = query.filter_by(parent_id=parent_id)
    elif channel_id is not None:
        query = query.filter_by(channel_id=channel_id, parent_id=None)
    elif conversation_id is not None:
        # Verify user is member of the conversation
        conv_member = ConversationMember.query.filter_by(conversation_id=conversation_id, user_id=current_user.id).first()
        if not conv_member:
            return error_response("You are not part of this conversation", 403)
        query = query.filter_by(conversation_id=conversation_id, parent_id=None)
    else:
        return error_response("channel_id, conversation_id, or parent_id required", 400)

    if before_id:
        query = query.filter(Message.id < before_id)

    # Order newest first for pagination, then reverse for display
    messages = query.order_by(Message.id.desc()).limit(limit).all()
    messages.reverse()

    return success_response({
        "messages": [m.to_dict(current_user_id=current_user.id) for m in messages],
        "has_more": len(messages) == limit
    })


@messages_bp.route("/messages", methods=["POST"])
@jwt_required()
@workspace_member_required()
def send_message(workspace_id):
    current_user = get_current_user()
    _cleanup_expired_messages()
    data = request.get_json() or {}
    content = data.get("content", "").strip()
    channel_id = data.get("channel_id")
    conversation_id = data.get("conversation_id")
    parent_id = data.get("parent_id")
    attachment_ids = data.get("attachment_ids", [])

    if not content and not attachment_ids:
        return error_response("Message content or attachment is required", 400)

    if channel_id:
        channel_id = int(channel_id)
        channel = Channel.query.filter_by(id=channel_id, workspace_id=workspace_id).first()
        if not channel:
            return error_response("Channel not found", 404)
        room_name = f"channel_{channel_id}"
    elif conversation_id:
        conversation_id = int(conversation_id)
        conv = Conversation.query.filter_by(id=conversation_id, workspace_id=workspace_id).first()
        if not conv:
            return error_response("Conversation not found", 404)
        conv_member = ConversationMember.query.filter_by(conversation_id=conversation_id, user_id=current_user.id).first()
        if not conv_member:
            return error_response("You are not part of this conversation", 403)
        room_name = f"conversation_{conversation_id}"
    elif parent_id:
        parent_msg = db.session.get(Message, int(parent_id))
        if not parent_msg or parent_msg.workspace_id != workspace_id:
            return error_response("Parent message not found", 404)
        channel_id = parent_msg.channel_id
        conversation_id = parent_msg.conversation_id
        room_name = f"thread_{parent_id}"
    else:
        return error_response("Target channel, conversation, or thread parent must be specified", 400)

    message = Message(
        workspace_id=workspace_id,
        channel_id=channel_id,
        conversation_id=conversation_id,
        parent_id=parent_id,
        user_id=current_user.id,
        content=content,
        expires_at=_message_expiry(),
    )
    db.session.add(message)
    db.session.flush()

    # Link file attachments if any
    if attachment_ids:
        for att_id in attachment_ids:
            att = FileAttachment.query.filter_by(id=att_id, workspace_id=workspace_id, user_id=current_user.id).first()
            if att:
                att.message_id = message.id

    # Detect @username mentions and trigger notifications
    mentions = re.findall(r'@([a-zA-Z0-9_]+)', content)
    for username in set(mentions):
        mentioned_user = User.query.filter_by(username=username).first()
        if mentioned_user and mentioned_user.id != current_user.id:
            notif = Notification(
                user_id=mentioned_user.id,
                actor_id=current_user.id,
                workspace_id=workspace_id,
                type="mention",
                title=f"Mentioned by {current_user.username}",
                content=f"{current_user.username} mentioned you: \"{content[:100]}\"",
                link=f"/workspaces/{workspace_id}/channel/{channel_id}" if channel_id else f"/workspaces/{workspace_id}/dm/{conversation_id}"
            )
            db.session.add(notif)
            # Emit live notification via Socket.IO
            socketio.emit("notification_new", notif.to_dict(), room=f"user_{mentioned_user.id}")

    db.session.commit()
    msg_dict = message.to_dict(current_user_id=current_user.id)
    if conversation_id and "conv" in locals():
        source_workspace = db.session.get(Workspace, workspace_id)
        _mirror_personal_message(source_workspace, conv, message)
    db.session.commit()

    # Emit via Socket.IO to room
    socketio.emit("message_new", msg_dict, room=room_name)
    if parent_id:
        socketio.emit("thread_reply_new", msg_dict, room=f"channel_{channel_id}" if channel_id else f"conversation_{conversation_id}")
    elif channel_id:
        socketio.emit("channel_message_notification", msg_dict, room=f"workspace_{workspace_id}")
    elif conversation_id and 'conv' in locals() and conv:
        for cm in conv.members:
            if cm.user_id != current_user.id:
                socketio.emit("dm_message_notification", msg_dict, room=f"user_{cm.user_id}")

    return success_response({"message": msg_dict}, "Message sent", 201)


@messages_bp.route("/messages/<int:message_id>", methods=["PUT"])
@jwt_required()
@workspace_member_required()
def edit_message(workspace_id, message_id):
    current_user = get_current_user()
    _cleanup_expired_messages()
    message = Message.query.filter_by(id=message_id, workspace_id=workspace_id).first()
    if not message:
        return error_response("Message not found", 404)

    if message.user_id != current_user.id:
        return error_response("You can only edit your own messages", 403)

    data = request.get_json() or {}
    new_content = data.get("content", "").strip()
    if not new_content:
        return error_response("Message content cannot be empty", 400)

    message.content = new_content
    message.is_edited = True
    message.edited_at = datetime.datetime.utcnow()
    db.session.commit()

    msg_dict = message.to_dict(current_user_id=current_user.id)
    room = f"channel_{message.channel_id}" if message.channel_id else f"conversation_{message.conversation_id}"
    socketio.emit("message_updated", msg_dict, room=room)
    if message.parent_id:
        socketio.emit("message_updated", msg_dict, room=f"thread_{message.parent_id}")

    return success_response({"message": msg_dict}, "Message updated")


@messages_bp.route("/messages/<int:message_id>", methods=["DELETE"])
@jwt_required()
@workspace_member_required()
def delete_message(workspace_id, message_id):
    current_user = get_current_user()
    _cleanup_expired_messages()
    message = Message.query.filter_by(id=message_id, workspace_id=workspace_id).first()
    if not message:
        return error_response("Message not found", 404)

    body = request.get_json(silent=True) or {}
    delete_for_everyone = request.args.get("delete_for_everyone", "").lower() == "true"
    if "delete_for_everyone" in body:
        delete_for_everyone = bool(body["delete_for_everyone"])
    is_conversation_message = message.conversation_id is not None
    can_delete_everyone = message.user_id == current_user.id or (
        not is_conversation_message
        and get_effective_workspace_role(workspace_id, current_user.id) == "owner"
    )
    if delete_for_everyone and not can_delete_everyone:
        return error_response("You can only delete your own message for everyone", 403)

    room = f"channel_{message.channel_id}" if message.channel_id else f"conversation_{message.conversation_id}"
    parent_id = message.parent_id
    mid = message.id

    if delete_for_everyone:
        source_id = message.source_message_id or message.id
        related_messages = Message.query.filter(
            (Message.id == source_id) | (Message.source_message_id == source_id)
        ).all()
        mirrored_messages = [item for item in related_messages if item.id != message.id]
        for related_message in related_messages:
            db.session.delete(related_message)
    else:
        existing_hidden = HiddenMessage.query.filter_by(
            message_id=message.id, user_id=current_user.id
        ).first()
        if not existing_hidden:
            db.session.add(HiddenMessage(message_id=message.id, user_id=current_user.id))
    db.session.commit()

    if delete_for_everyone:
        socketio.emit("message_deleted", {"message_id": mid}, room=room)
        for mirrored_message in mirrored_messages:
            mirrored_room = (
                f"channel_{mirrored_message.channel_id}"
                if mirrored_message.channel_id
                else f"conversation_{mirrored_message.conversation_id}"
            )
            socketio.emit(
                "message_deleted",
                {"message_id": mirrored_message.id},
                room=mirrored_room,
            )
    if parent_id and delete_for_everyone:
        socketio.emit("message_deleted", {"message_id": mid}, room=f"thread_{parent_id}")

    return success_response(None, "Message deleted for everyone" if delete_for_everyone else "Message deleted for you")


@messages_bp.route("/messages/<int:message_id>/reactions", methods=["POST"])
@jwt_required()
@workspace_member_required()
def toggle_reaction(workspace_id, message_id):
    current_user = get_current_user()
    _cleanup_expired_messages()
    message = Message.query.filter_by(id=message_id, workspace_id=workspace_id).first()
    if not message:
        return error_response("Message not found", 404)

    data = request.get_json() or {}
    emoji = data.get("emoji", "").strip()
    if not emoji:
        return error_response("Emoji is required", 400)

    reaction = MessageReaction.query.filter_by(
        message_id=message_id,
        user_id=current_user.id,
        emoji=emoji
    ).first()

    if reaction:
        db.session.delete(reaction)
        action = "removed"
    else:
        reaction = MessageReaction(
            message_id=message_id,
            user_id=current_user.id,
            emoji=emoji
        )
        db.session.add(reaction)
        action = "added"

    db.session.commit()
    msg_dict = message.to_dict(current_user_id=current_user.id)
    room = f"channel_{message.channel_id}" if message.channel_id else f"conversation_{message.conversation_id}"
    socketio.emit("message_reaction", {"message_id": message_id, "reactions": msg_dict["reactions"]}, room=room)

    return success_response({"action": action, "reactions": msg_dict["reactions"]})


@messages_bp.route("/conversations", methods=["GET"])
@jwt_required()
@workspace_member_required()
def list_conversations(workspace_id):
    current_user = get_current_user()
    _cleanup_expired_messages()
    memberships = ConversationMember.query.filter_by(user_id=current_user.id).all()
    convs = []
    for m in memberships:
        if m.conversation.workspace_id == workspace_id:
            conv_data = m.conversation.to_dict(current_user_id=current_user.id)
            # Find last message
            last_msg = Message.query.filter_by(conversation_id=m.conversation.id).order_by(Message.id.desc()).first()
            conv_data["last_message"] = last_msg.to_dict() if last_msg else None
            convs.append(conv_data)

    return success_response({"conversations": convs})


@messages_bp.route("/conversations", methods=["POST"])
@jwt_required()
@workspace_member_required()
def start_conversation(workspace_id):
    current_user = get_current_user()
    data = request.get_json() or {}
    participant_ids = data.get("participant_ids", [])  # List of user IDs
    is_group = bool(data.get("is_group", False))
    title = data.get("title")

    if not participant_ids:
        return error_response("At least one participant is required", 400)

    # Ensure current user is included
    all_user_ids = list(set([current_user.id] + [int(uid) for uid in participant_ids]))

    # For 1-to-1 DMs, check if existing conversation already exists
    if len(all_user_ids) == 2 and not is_group:
        other_user_id = all_user_ids[0] if all_user_ids[0] != current_user.id else all_user_ids[1]
        existing_convs = db.session.query(Conversation).join(ConversationMember).filter(
            Conversation.workspace_id == workspace_id,
            Conversation.is_group == False,
            ConversationMember.user_id.in_(all_user_ids)
        ).group_by(Conversation.id).having(db.func.count(ConversationMember.id) == 2).all()

        for c in existing_convs:
            c_members = set([m.user_id for m in c.members])
            if c_members == set(all_user_ids):
                _provision_personal_conversations(
                    db.session.get(Workspace, workspace_id), all_user_ids
                )
                db.session.commit()
                return success_response({"conversation": c.to_dict(current_user_id=current_user.id)})

    # Create new conversation
    conversation = Conversation(
        workspace_id=workspace_id,
        is_group=len(all_user_ids) > 2 or is_group,
        title=title
    )
    db.session.add(conversation)
    db.session.flush()

    for uid in all_user_ids:
        db.session.add(ConversationMember(conversation_id=conversation.id, user_id=uid))

    _provision_personal_conversations(
        db.session.get(Workspace, workspace_id), all_user_ids
    )
    db.session.commit()
    return success_response({"conversation": conversation.to_dict(current_user_id=current_user.id)}, "Conversation started", 201)


@messages_bp.route("/conversations/<int:conversation_id>", methods=["DELETE"])
@jwt_required()
@workspace_member_required()
def delete_conversation(workspace_id, conversation_id):
    current_user = get_current_user()
    conversation = Conversation.query.filter_by(
        id=conversation_id, workspace_id=workspace_id
    ).first()
    if not conversation:
        return error_response("Conversation not found", 404)
    if not ConversationMember.query.filter_by(
        conversation_id=conversation.id, user_id=current_user.id
    ).first():
        return error_response("You are not a member of this conversation", 403)
    db.session.delete(conversation)
    db.session.commit()
    return success_response(None, "Conversation deleted")


@messages_bp.route("/messages/search", methods=["GET"])
@jwt_required()
@workspace_member_required()
def search_messages(workspace_id):
    _cleanup_expired_messages()
    query = request.args.get("q", "").strip()
    if not query:
        return success_response({"messages": []})

    messages = Message.query.filter(
        Message.workspace_id == workspace_id,
        Message.content.ilike(f"%{query}%")
    ).order_by(Message.id.desc()).limit(30).all()

    return success_response({"messages": [m.to_dict() for m in messages]})
