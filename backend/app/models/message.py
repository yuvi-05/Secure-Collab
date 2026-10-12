import datetime
from app.extensions import db

class Message(db.Model):
    __tablename__ = "messages"

    id = db.Column(db.Integer, primary_key=True)
    workspace_id = db.Column(db.Integer, db.ForeignKey("workspaces.id"), nullable=False, index=True)
    channel_id = db.Column(db.Integer, db.ForeignKey("channels.id"), nullable=True, index=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey("conversations.id"), nullable=True, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    parent_id = db.Column(db.Integer, db.ForeignKey("messages.id"), nullable=True, index=True)
    content = db.Column(db.Text, nullable=False)
    is_edited = db.Column(db.Boolean, default=False)
    edited_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, index=True)

    # Relationships
    user = db.relationship("User", back_populates="messages")
    channel = db.relationship("Channel", back_populates="messages")
    conversation = db.relationship("Conversation", back_populates="messages")
    parent = db.relationship("Message", remote_side=[id], backref=db.backref("replies", lazy="dynamic"))
    reactions = db.relationship("MessageReaction", back_populates="message", cascade="all, delete-orphan")
    attachments = db.relationship("FileAttachment", back_populates="message", cascade="all, delete-orphan")

    def to_dict(self, current_user_id: int = None):
        # Aggregate reactions by emoji
        reaction_counts = {}
        for r in self.reactions:
            if r.emoji not in reaction_counts:
                reaction_counts[r.emoji] = {
                    "emoji": r.emoji,
                    "count": 0,
                    "users": [],
                    "reacted_by_me": False
                }
            reaction_counts[r.emoji]["count"] += 1
            reaction_counts[r.emoji]["users"].append(r.user.username if r.user else "Unknown")
            if current_user_id and r.user_id == current_user_id:
                reaction_counts[r.emoji]["reacted_by_me"] = True

        reply_count = self.replies.count() if hasattr(self, 'replies') else 0

        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "channel_id": self.channel_id,
            "conversation_id": self.conversation_id,
            "user_id": self.user_id,
            "user": self.user.to_dict() if self.user else None,
            "parent_id": self.parent_id,
            "content": self.content,
            "is_edited": self.is_edited,
            "edited_at": self.edited_at.isoformat() if self.edited_at else None,
            "reply_count": reply_count,
            "reactions": list(reaction_counts.values()),
            "attachments": [a.to_dict() for a in self.attachments],
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class MessageReaction(db.Model):
    __tablename__ = "message_reactions"
    __table_args__ = (db.UniqueConstraint("message_id", "user_id", "emoji", name="uq_msg_user_emoji"),)

    id = db.Column(db.Integer, primary_key=True)
    message_id = db.Column(db.Integer, db.ForeignKey("messages.id"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    emoji = db.Column(db.String(32), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    message = db.relationship("Message", back_populates="reactions")
    user = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "message_id": self.message_id,
            "user_id": self.user_id,
            "emoji": self.emoji,
            "user": self.user.to_dict() if self.user else None,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
