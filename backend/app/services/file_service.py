import os
from pathlib import Path
from werkzeug.datastructures import FileStorage
from app.config import Config
from app.extensions import db
from app.models import FileAttachment
from app.utils.security import allowed_file, generate_safe_filename

class FileService:
    @staticmethod
    def save_file(file: FileStorage, workspace_id: int, user_id: int, message_id: int = None, is_public: bool = False) -> FileAttachment:
        if not file or not file.filename:
            raise ValueError("No file provided")

        if not allowed_file(file.filename):
            raise ValueError("File type not allowed")

        original_name, unique_name = generate_safe_filename(file.filename)
        
        # Target directory per workspace
        upload_dir = Path(Config.UPLOAD_FOLDER) / str(workspace_id)
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        target_path = upload_dir / unique_name
        file.save(str(target_path))
        
        file_size = target_path.stat().st_size
        content_type = file.content_type or "application/octet-stream"

        attachment = FileAttachment(
            workspace_id=workspace_id,
            user_id=user_id,
            message_id=message_id,
            filename=original_name,
            storage_path=str(target_path),
            file_size=file_size,
            content_type=content_type,
            is_public=is_public
        )
        db.session.add(attachment)
        db.session.commit()
        return attachment

    @staticmethod
    def get_file_path(attachment: FileAttachment) -> Path:
        path = Path(attachment.storage_path)
        if not path.exists():
            raise FileNotFoundError("Physical file does not exist on disk")
        return path
