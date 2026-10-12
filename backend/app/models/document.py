import datetime
from app.extensions import db

class CollaborativeDocument(db.Model):
    __tablename__ = "collaborative_documents"
    __table_args__ = (db.UniqueConstraint("file_id", name="uq_collab_file"),)

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("coding_projects.id"), nullable=False, index=True)
    file_id = db.Column(db.Integer, db.ForeignKey("project_files.id"), nullable=False, index=True)
    # Store binary/base64 Yjs CRDT document state update
    yjs_state = db.Column(db.Text, nullable=True)
    version = db.Column(db.Integer, default=1)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    file = db.relationship("ProjectFile")
    project = db.relationship("CodingProject")

    def to_dict(self):
        return {
            "id": self.id,
            "project_id": self.project_id,
            "file_id": self.file_id,
            "version": self.version,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
