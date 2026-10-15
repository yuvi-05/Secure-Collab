import datetime
import uuid
from app.extensions import db
from app.utils.datetime_utils import utc_now


def _utcnow_naive():
    return utc_now().replace(tzinfo=None)

WORKSPACE_ROLES = frozenset({"owner", "project_manager", "developer", "team_member", "guest"})
ASSIGNABLE_WORKSPACE_ROLES = WORKSPACE_ROLES - {"owner"}


class Workspace(db.Model):
    __tablename__ = "workspaces"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    slug = db.Column(db.String(120), unique=True, nullable=False, index=True)
    description = db.Column(db.String(255), nullable=True)
    icon_url = db.Column(db.String(512), nullable=True)
    is_personal = db.Column(db.Boolean, nullable=False, default=False, index=True)
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
    emergency_access_requests = db.relationship(
        "EmergencyAccessRequest",
        back_populates="workspace",
        cascade="all, delete-orphan"
    )
    settings = db.relationship("WorkspaceSetting", back_populates="workspace", cascade="all, delete-orphan")
    audit_logs = db.relationship("WorkspaceAuditLog", back_populates="workspace", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "description": self.description or "",
            "icon_url": self.icon_url or f"https://api.dicebear.com/7.x/identicon/svg?seed={self.slug}",
            "owner_id": self.owner_id,
            "is_personal": self.is_personal,
            "member_count": sum(1 for member in self.members if member.is_active) if self.members else 0,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class WorkspaceMember(db.Model):
    __tablename__ = "workspace_members"
    __table_args__ = (db.UniqueConstraint("workspace_id", "user_id", name="uq_workspace_user"),)

    id = db.Column(db.Integer, primary_key=True)
    workspace_id = db.Column(db.Integer, db.ForeignKey("workspaces.id"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    role = db.Column(db.String(20), default="team_member")
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    joined_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    workspace = db.relationship("Workspace", back_populates="members")
    user = db.relationship("User", back_populates="workspace_memberships")

    def to_dict(self):
        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "user_id": self.user_id,
            "role": self.role,
            "is_active": self.is_active,
            "joined_at": self.joined_at.isoformat() if self.joined_at else None,
            "user": self.user.to_dict() if self.user else None
        }


class Invitation(db.Model):
    __tablename__ = "invitations"

    id = db.Column(db.Integer, primary_key=True)
    workspace_id = db.Column(db.Integer, db.ForeignKey("workspaces.id"), nullable=False, index=True)
    inviter_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    email = db.Column(db.String(120), nullable=False, index=True)
    role = db.Column(db.String(20), default="team_member")
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


class EmergencyAccessRequest(db.Model):
    __tablename__ = "emergency_access_requests"

    id = db.Column(db.Integer, primary_key=True)
    workspace_id = db.Column(db.Integer, db.ForeignKey("workspaces.id"), nullable=False, index=True)
    requester_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    reason = db.Column(db.Text, nullable=False)
    requested_role = db.Column(db.String(20), nullable=False, default="project_manager")
    status = db.Column(db.String(20), nullable=False, default="pending", index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=_utcnow_naive)
    reviewer_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    expires_at = db.Column(db.DateTime, nullable=True)
    revoked_at = db.Column(db.DateTime, nullable=True)
    revoker_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    project_grants = db.relationship(
        "EmergencyAccessProject",
        back_populates="access_request",
        cascade="all, delete-orphan"
    )

    workspace = db.relationship("Workspace", back_populates="emergency_access_requests")
    requester = db.relationship("User", foreign_keys=[requester_id])
    reviewer = db.relationship("User", foreign_keys=[reviewer_id])
    revoker = db.relationship("User", foreign_keys=[revoker_id])

    @property
    def is_active(self):
        return (
            self.status == "approved"
            and self.expires_at is not None
            and self.expires_at > _utcnow_naive()
            and self.revoked_at is None
        )

    def to_dict(self):
        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "requester_id": self.requester_id,
            "requester": self.requester.to_dict() if self.requester else None,
            "reason": self.reason,
            "requested_role": self.requested_role,
            "project_ids": [grant.project_id for grant in self.project_grants],
            "projects": [
                {
                    "id": grant.project_id,
                    "name": grant.project.name if grant.project else f"Project {grant.project_id}"
                }
                for grant in self.project_grants
            ],
            "status": "expired" if self.status == "approved" and not self.is_active else self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "reviewer_id": self.reviewer_id,
            "reviewer": self.reviewer.to_dict() if self.reviewer else None,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "revoked_at": self.revoked_at.isoformat() if self.revoked_at else None,
            "revoker_id": self.revoker_id,
            "is_active": self.is_active
        }


def get_active_emergency_access(workspace_id, user_id):
    return EmergencyAccessRequest.query.filter(
        EmergencyAccessRequest.workspace_id == workspace_id,
        EmergencyAccessRequest.requester_id == user_id,
        EmergencyAccessRequest.status == "approved",
        EmergencyAccessRequest.expires_at > _utcnow_naive(),
        EmergencyAccessRequest.revoked_at.is_(None)
    ).first()


def get_effective_workspace_role(workspace_id, user_id):
    membership = WorkspaceMember.query.filter_by(
        workspace_id=workspace_id,
        user_id=user_id
    ).first()
    if not membership:
        return None
    if not membership.is_active:
        return None
    return membership.role


def get_effective_project_role(workspace_id, project_id, user_id):
    membership = WorkspaceMember.query.filter_by(
        workspace_id=workspace_id,
        user_id=user_id,
        is_active=True
    ).first()
    if not membership:
        return None
    if membership.role in {"owner", "project_manager"}:
        return membership.role
    active_grant = get_active_project_emergency_access(workspace_id, project_id, user_id)
    if active_grant:
        return active_grant.requested_role
    return membership.role


def get_active_project_emergency_access(workspace_id, project_id, user_id):
    return EmergencyAccessRequest.query.join(EmergencyAccessProject).filter(
        EmergencyAccessRequest.workspace_id == workspace_id,
        EmergencyAccessRequest.requester_id == user_id,
        EmergencyAccessRequest.status == "approved",
        EmergencyAccessRequest.expires_at > _utcnow_naive(),
        EmergencyAccessRequest.revoked_at.is_(None),
        EmergencyAccessProject.project_id == project_id
    ).first()


class EmergencyAccessProject(db.Model):
    __tablename__ = "emergency_access_projects"
    __table_args__ = (
        db.UniqueConstraint("request_id", "project_id", name="uq_emergency_request_project"),
    )

    id = db.Column(db.Integer, primary_key=True)
    request_id = db.Column(
        db.Integer,
        db.ForeignKey("emergency_access_requests.id"),
        nullable=False,
        index=True
    )
    project_id = db.Column(db.Integer, db.ForeignKey("coding_projects.id"), nullable=False, index=True)

    access_request = db.relationship("EmergencyAccessRequest", back_populates="project_grants")
    project = db.relationship("CodingProject")


class WorkspaceSetting(db.Model):
    __tablename__ = "workspace_settings"
    __table_args__ = (db.UniqueConstraint("workspace_id", "key", name="uq_workspace_setting_key"),)

    id = db.Column(db.Integer, primary_key=True)
    workspace_id = db.Column(db.Integer, db.ForeignKey("workspaces.id"), nullable=False, index=True)
    key = db.Column(db.String(80), nullable=False)
    value = db.Column(db.String(255), nullable=False)
    updated_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    updated_at = db.Column(db.DateTime, nullable=False, default=_utcnow_naive, onupdate=_utcnow_naive)

    workspace = db.relationship("Workspace", back_populates="settings")
    updater = db.relationship("User")


class WorkspaceAuditLog(db.Model):
    __tablename__ = "workspace_audit_logs"

    id = db.Column(db.Integer, primary_key=True)
    workspace_id = db.Column(db.Integer, db.ForeignKey("workspaces.id"), nullable=False, index=True)
    actor_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    action = db.Column(db.String(80), nullable=False, index=True)
    target_type = db.Column(db.String(40), nullable=False)
    target_id = db.Column(db.String(80), nullable=False)
    details = db.Column(db.Text, nullable=False, default="{}")
    created_at = db.Column(db.DateTime, nullable=False, default=_utcnow_naive, index=True)

    workspace = db.relationship("Workspace", back_populates="audit_logs")
    actor = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "actor_id": self.actor_id,
            "actor": self.actor.to_dict() if self.actor else None,
            "action": self.action,
            "target_type": self.target_type,
            "target_id": self.target_id,
            "details": self.details,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
