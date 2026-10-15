import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from app.extensions import db
from app.utils.datetime_utils import utc_now

class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    full_name = db.Column(db.String(120), nullable=True)
    avatar_url = db.Column(db.String(512), nullable=True)
    bio = db.Column(db.String(255), nullable=True)
    is_online = db.Column(db.Boolean, default=False)
    last_seen = db.Column(db.DateTime, default=utc_now)
    is_active = db.Column(db.Boolean, nullable=False, default=True, index=True)
    is_super_admin = db.Column(db.Boolean, nullable=False, default=False, index=True)
    created_at = db.Column(db.DateTime, default=utc_now)
    updated_at = db.Column(db.DateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    workspace_memberships = db.relationship("WorkspaceMember", back_populates="user", cascade="all, delete-orphan")
    messages = db.relationship("Message", back_populates="user", cascade="all, delete-orphan")
    notifications = db.relationship("Notification", back_populates="recipient", foreign_keys="Notification.user_id", cascade="all, delete-orphan")

    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def to_dict(self, include_private: bool = False):
        data = {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "full_name": self.full_name or self.username,
            "avatar_url": self.avatar_url or f"https://api.dicebear.com/7.x/identicon/svg?seed={self.username}",
            "bio": self.bio or "",
            "is_online": self.is_online,
            "is_super_admin": self.is_super_admin,
            "last_seen": self.last_seen.isoformat() if self.last_seen else None,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
        return data
