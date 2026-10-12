import datetime
from app.extensions import db

class AIConversation(db.Model):
    __tablename__ = "ai_conversations"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    project_id = db.Column(db.Integer, db.ForeignKey("coding_projects.id"), nullable=True, index=True)
    workspace_id = db.Column(db.Integer, db.ForeignKey("workspaces.id"), nullable=False, index=True)
    title = db.Column(db.String(150), default="New Chat")
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    user = db.relationship("User")
    project = db.relationship("CodingProject", back_populates="ai_conversations")
    workspace = db.relationship("Workspace")
    messages = db.relationship("AIMessage", back_populates="conversation", cascade="all, delete-orphan", order_by="AIMessage.created_at.asc()")

    def to_dict(self, include_messages=True):
        data = {
            "id": self.id,
            "user_id": self.user_id,
            "project_id": self.project_id,
            "workspace_id": self.workspace_id,
            "title": self.title,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
        if include_messages:
            data["messages"] = [m.to_dict() for m in self.messages]
        return data


class AIMessage(db.Model):
    __tablename__ = "ai_messages"

    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey("ai_conversations.id"), nullable=False, index=True)
    sender = db.Column(db.String(20), nullable=False)  # 'user' or 'assistant'
    content = db.Column(db.Text, nullable=False)
    code_context = db.Column(db.Text, nullable=True)  # Selected code or file snippet
    suggested_diff = db.Column(db.Text, nullable=True)  # Diff representation if refactoring/generating code
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    conversation = db.relationship("AIConversation", back_populates="messages")

    def to_dict(self):
        return {
            "id": self.id,
            "conversation_id": self.conversation_id,
            "sender": self.sender,
            "content": self.content,
            "code_context": self.code_context,
            "suggested_diff": self.suggested_diff,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
