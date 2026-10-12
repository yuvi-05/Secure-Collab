import os
import uuid
from werkzeug.utils import secure_filename
from app.config import Config

LANGUAGE_MAP = {
    'py': 'python',
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'html': 'html',
    'css': 'css',
    'scss': 'css',
    'json': 'json',
    'md': 'markdown',
    'sql': 'sql',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'sh': 'shell',
    'yml': 'yaml',
    'yaml': 'yaml',
    'xml': 'xml',
    'go': 'go',
    'rs': 'rust',
    'rb': 'ruby',
    'php': 'php',
    'txt': 'plaintext'
}

def allowed_file(filename: str) -> bool:
    if not filename or '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[1].lower()
    return ext in Config.ALLOWED_EXTENSIONS

def generate_safe_filename(original_filename: str) -> tuple[str, str]:
    """Returns (original_safe_name, unique_storage_filename)"""
    safe_name = secure_filename(original_filename) or "unnamed_file"
    ext = safe_name.rsplit('.', 1)[1].lower() if '.' in safe_name else "bin"
    unique_name = f"{uuid.uuid4().hex}.{ext}"
    return safe_name, unique_name

def sanitize_filepath(filepath: str) -> str:
    """Normalize file path and prevent directory traversal (e.g. '../')"""
    parts = [p for p in filepath.replace('\\', '/').split('/') if p and p != '..']
    return '/'.join(parts)

def detect_language(filename: str) -> str:
    if not filename or '.' not in filename:
        return 'plaintext'
    ext = filename.rsplit('.', 1)[1].lower()
    return LANGUAGE_MAP.get(ext, 'plaintext')
