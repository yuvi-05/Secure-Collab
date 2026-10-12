import datetime
import uuid
from app.extensions import db

class Workspace(db.Model):
    __tablename__ = "workspaces"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    slug = db.Column(db.String(120), unique=True, nullable=False, index=True)
    description = db.Column(db.String(255), nullable=True)
    icon_url = db.Column(db.String(512), nullable=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    owner = db.relationship("User", foreign_keys=[owner_id])
    members = db.relationship("WorkspaceMember", back_populates="workspace", cascade="all, delete-orphan")
    channels = db.relationship("Channel", back_populates="workspace", cascade="all, delete-orphan")
    conversations = db.relationship("Conversation", back_populates="workspace", cascade="all, delete-orphan")
    projects = db.relationship("CodingProject", back_populates="workspace", cascade="all, delete-orphan")
    files = db.relationship("FileAttachment", back_populates="workspace", cascade="all, delete-orphan")
    invitations = db.relationship("Invitation", back_populates="workspace", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "description": self.description or "",
            "icon_url": self.icon_url or f"https://api.dicebear.com/7.x/identicon/svg?seed={self.slug}",
            "owner_id": self.owner_id,
            "member_count": len(self.members) if self.members else 0,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class WorkspaceMember(db.Model):
    __tablename__ = "workspace_members"
    __table_args__ = (db.UniqueConstraint("workspace_id", "user_id", name="uq_workspace_user"),)

    id = db.Column(db.Integer, primary_key=True)
    workspace_id = db.Column(db.Integer, db.ForeignKey("workspaces.id"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    role = db.Column(db.String(20), default="member")  # 'owner', 'admin', 'member'
    joined_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    workspace = db.relationship("Workspace", back_populates="members")
    user = db.relationship("User", back_populates="workspace_memberships")

    def to_dict(self):
        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "user_id": self.user_id,
            "role": self.role,
            "joined_at": self.joined_at.isoformat() if self.joined_at else None,
            "user": self.user.to_dict() if self.user else None
        }


class Invitation(db.Model):
    __tablename__ = "invitations"

    id = db.Column(db.Integer, primary_key=True)
    workspace_id = db.Column(db.Integer, db.ForeignKey("workspaces.id"), nullable=False, index=True)
    inviter_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    email = db.Column(db.String(120), nullable=False, index=True)
    role = db.Column(db.String(20), default="member")
    token = db.Column(db.String(64), unique=True, nullable=False, index=True)
    status = db.Column(db.String(20), default="pending")  # 'pending', 'accepted', 'declined', 'expired'
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    expires_at = db.Column(db.DateTime, default=lambda: datetime.datetime.utcnow() + datetime.timedelta(days=7))

    workspace = db.relationship("Workspace", back_populates="invitations")
    inviter = db.relationship("User", foreign_keys=[inviter_id])

    def to_dict(self):
        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "workspace_name": self.workspace.name if self.workspace else "",
            "inviter": self.inviter.to_dict() if self.inviter else None,
            "email": self.email,
            "role": self.role,
            "token": self.token,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None
        }
