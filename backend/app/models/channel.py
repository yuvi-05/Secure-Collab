import datetime
from app.extensions import db

class Channel(db.Model):
    __tablename__ = "channels"
    __table_args__ = (db.UniqueConstraint("workspace_id", "name", name="uq_workspace_channel_name"),)

    id = db.Column(db.Integer, primary_key=True)
    workspace_id = db.Column(db.Integer, db.ForeignKey("workspaces.id"), nullable=False, index=True)
    name = db.Column(db.String(80), nullable=False)
    topic = db.Column(db.String(255), nullable=True)
    description = db.Column(db.Text, nullable=True)
    is_private = db.Column(db.Boolean, default=False)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    workspace = db.relationship("Workspace", back_populates="channels")
    creator = db.relationship("User", foreign_keys=[created_by])
    members = db.relationship("ChannelMember", back_populates="channel", cascade="all, delete-orphan")
    messages = db.relationship("Message", back_populates="channel", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "name": self.name,
            "topic": self.topic or "",
            "description": self.description or "",
            "is_private": self.is_private,
            "created_by": self.created_by,
            "member_count": len(self.members) if self.members else 0,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class ChannelMember(db.Model):
    __tablename__ = "channel_members"
    __table_args__ = (db.UniqueConstraint("channel_id", "user_id", name="uq_channel_user"),)

    id = db.Column(db.Integer, primary_key=True)
    channel_id = db.Column(db.Integer, db.ForeignKey("channels.id"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    role = db.Column(db.String(20), default="member")  # 'admin', 'member'
    last_read_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    joined_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    channel = db.relationship("Channel", back_populates="members")
    user = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "channel_id": self.channel_id,
            "user_id": self.user_id,
            "role": self.role,
            "last_read_at": self.last_read_at.isoformat() if self.last_read_at else None,
            "joined_at": self.joined_at.isoformat() if self.joined_at else None,
            "user": self.user.to_dict() if self.user else None
        }
