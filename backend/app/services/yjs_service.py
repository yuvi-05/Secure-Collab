import datetime
from app.extensions import db
from app.models import CollaborativeDocument, ProjectFile

class YjsService:
    @staticmethod
    def get_or_create_doc(project_id: int, file_id: int) -> CollaborativeDocument:
        doc = CollaborativeDocument.query.filter_by(file_id=file_id).first()
        if not doc:
            doc = CollaborativeDocument(
                project_id=project_id,
                file_id=file_id,
                yjs_state="",
                version=1
            )
            db.session.add(doc)
            db.session.commit()
        return doc

    @staticmethod
    def save_doc_state(file_id: int, yjs_state: str, plaintext_content: str = None, user_id: int = None) -> CollaborativeDocument:
        doc = CollaborativeDocument.query.filter_by(file_id=file_id).first()
        if not doc:
            pfile = ProjectFile.query.get(file_id)
            if not pfile:
                raise ValueError("Project file not found")
            doc = CollaborativeDocument(
                project_id=pfile.project_id,
                file_id=file_id,
                yjs_state=yjs_state,
                version=1
            )
            db.session.add(doc)
        else:
            doc.yjs_state = yjs_state
            doc.version += 1
            doc.updated_at = datetime.datetime.utcnow()

        if plaintext_content is not None:
            pfile = ProjectFile.query.get(file_id)
            if pfile:
                pfile.content = plaintext_content
                pfile.updated_at = datetime.datetime.utcnow()
                if user_id:
                    pfile.updated_by = user_id

        db.session.commit()
        return doc
