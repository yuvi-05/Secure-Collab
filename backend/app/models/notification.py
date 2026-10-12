import datetime
from app.extensions import db

class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    actor_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    workspace_id = db.Column(db.Integer, db.ForeignKey("workspaces.id"), nullable=True, index=True)
    type = db.Column(db.String(50), nullable=False)  # mention, direct_message, channel_message, invitation, project_update
    title = db.Column(db.String(150), nullable=False)
    content = db.Column(db.Text, nullable=False)
    link = db.Column(db.String(255), nullable=True)
    is_read = db.Column(db.Boolean, default=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, index=True)

    recipient = db.relationship("User", foreign_keys=[user_id], back_populates="notifications")
    actor = db.relationship("User", foreign_keys=[actor_id])
    workspace = db.relationship("Workspace", foreign_keys=[workspace_id])

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "actor_id": self.actor_id,
            "actor": self.actor.to_dict() if self.actor else None,
            "workspace_id": self.workspace_id,
            "type": self.type,
            "title": self.title,
            "content": self.content,
            "link": self.link or "",
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
