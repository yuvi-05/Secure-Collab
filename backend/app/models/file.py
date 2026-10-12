import datetime
from app.extensions import db

class FileAttachment(db.Model):
    __tablename__ = "file_attachments"

    id = db.Column(db.Integer, primary_key=True)
    workspace_id = db.Column(db.Integer, db.ForeignKey("workspaces.id"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    message_id = db.Column(db.Integer, db.ForeignKey("messages.id"), nullable=True, index=True)
    filename = db.Column(db.String(255), nullable=False)
    storage_path = db.Column(db.String(512), nullable=False)
    file_size = db.Column(db.BigInteger, nullable=False)
    content_type = db.Column(db.String(100), nullable=False)
    is_public = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    # Relationships
    workspace = db.relationship("Workspace", back_populates="files")
    uploader = db.relationship("User", foreign_keys=[user_id])
    message = db.relationship("Message", back_populates="attachments")

    def to_dict(self):
        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "user_id": self.user_id,
            "uploader": self.uploader.to_dict() if self.uploader else None,
            "message_id": self.message_id,
            "filename": self.filename,
            "file_size": self.file_size,
            "content_type": self.content_type,
            "download_url": f"/api/workspaces/{self.workspace_id}/files/{self.id}/download",
            "preview_url": f"/api/workspaces/{self.workspace_id}/files/{self.id}/preview",
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
