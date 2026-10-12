import datetime
from app.extensions import db

class Conversation(db.Model):
    __tablename__ = "conversations"

    id = db.Column(db.Integer, primary_key=True)
    workspace_id = db.Column(db.Integer, db.ForeignKey("workspaces.id"), nullable=False, index=True)
    is_group = db.Column(db.Boolean, default=False)
    title = db.Column(db.String(120), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    workspace = db.relationship("Workspace", back_populates="conversations")
    members = db.relationship("ConversationMember", back_populates="conversation", cascade="all, delete-orphan")
    messages = db.relationship("Message", back_populates="conversation", cascade="all, delete-orphan")

    def to_dict(self, current_user_id: int = None):
        members_list = [m.to_dict() for m in self.members]
        # Generate display title if not set
        display_title = self.title
        if not display_title:
            other_users = [m["user"]["username"] for m in members_list if m["user_id"] != current_user_id]
            display_title = ", ".join(other_users) if other_users else "Direct Message"

        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "is_group": self.is_group,
            "title": display_title,
            "members": members_list,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class ConversationMember(db.Model):
    __tablename__ = "conversation_members"
    __table_args__ = (db.UniqueConstraint("conversation_id", "user_id", name="uq_conv_user"),)

    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey("conversations.id"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    last_read_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    joined_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    conversation = db.relationship("Conversation", back_populates="members")
    user = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "conversation_id": self.conversation_id,
            "user_id": self.user_id,
            "last_read_at": self.last_read_at.isoformat() if self.last_read_at else None,
            "user": self.user.to_dict() if self.user else None
        }
