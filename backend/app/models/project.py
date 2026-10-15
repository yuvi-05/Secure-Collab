import datetime
from app.extensions import db

class CodingProject(db.Model):
    __tablename__ = "coding_projects"

    id = db.Column(db.Integer, primary_key=True)
    workspace_id = db.Column(db.Integer, db.ForeignKey("workspaces.id"), nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.String(255), nullable=True)
    is_active = db.Column(db.Boolean, nullable=False, default=True, index=True)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    workspace = db.relationship("Workspace", back_populates="projects")
    creator = db.relationship("User", foreign_keys=[created_by])
    members = db.relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    files = db.relationship("ProjectFile", back_populates="project", cascade="all, delete-orphan")
    ai_conversations = db.relationship("AIConversation", back_populates="project", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "name": self.name,
            "description": self.description or "",
            "created_by": self.created_by,
            "creator": self.creator.to_dict() if self.creator else None,
            "file_count": len([f for f in self.files if not f.is_directory]) if self.files else 0,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class ProjectMember(db.Model):
    __tablename__ = "project_members"
    __table_args__ = (db.UniqueConstraint("project_id", "user_id", name="uq_proj_user"),)

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("coding_projects.id"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    role = db.Column(db.String(20), default="editor")  # 'admin', 'editor', 'viewer'
    joined_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    project = db.relationship("CodingProject", back_populates="members")
    user = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "project_id": self.project_id,
            "user_id": self.user_id,
            "role": self.role,
            "joined_at": self.joined_at.isoformat() if self.joined_at else None,
            "user": self.user.to_dict() if self.user else None
        }


class ProjectFile(db.Model):
    __tablename__ = "project_files"
    __table_args__ = (db.UniqueConstraint("project_id", "path", name="uq_proj_filepath"),)

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("coding_projects.id"), nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    path = db.Column(db.String(512), nullable=False)  # e.g. "src/app.py"
    is_directory = db.Column(db.Boolean, default=False)
    content = db.Column(db.Text, default="")
    language = db.Column(db.String(50), default="plaintext")
    parent_path = db.Column(db.String(512), default="")
    updated_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    project = db.relationship("CodingProject", back_populates="files")
    updater = db.relationship("User", foreign_keys=[updated_by])

    def to_dict(self, include_content=True):
        data = {
            "id": self.id,
            "project_id": self.project_id,
            "name": self.name,
            "path": self.path,
            "is_directory": self.is_directory,
            "language": self.language,
            "parent_path": self.parent_path or "",
            "size": len(self.content.encode('utf-8')) if self.content else 0,
            "updated_by": self.updated_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
        if include_content and not self.is_directory:
            data["content"] = self.content or ""
        return data
