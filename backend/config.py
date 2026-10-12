import os
from datetime import timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secure-collab-secret-key-32bytes-long-2026")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-super-secret-key-secure-collab-2026-production")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=7)
    
    # Database Configuration - defaults to SQLite for immediate local plug-and-play,
    # or PostgreSQL when DATABASE_URL is configured (e.g. in Docker or production)
    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        # Fallback to local SQLite file
        sqlite_path = BASE_DIR / "secure_collab.db"
        DATABASE_URL = f"sqlite:///{sqlite_path.as_posix()}"
    
    # Fix for postgres:// vs postgresql:// in modern SQLAlchemy
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
        
    SQLALCHEMY_DATABASE_URI = DATABASE_URL
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Redis for Socket.IO (optional)
    REDIS_URL = os.getenv("REDIS_URL", None)
    
    # File upload configurations
    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", str(BASE_DIR / "uploads"))
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50 MB limit
    ALLOWED_EXTENSIONS = {
        # Images
        'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg',
        # Documents
        'pdf', 'txt', 'md', 'json', 'csv', 'log',
        # Code
        'py', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'java', 'cpp', 'c', 'h', 'hpp', 'sql', 'sh', 'yaml', 'yml',
        # Archives
        'zip', 'tar', 'gz'
    }

    # Modular AI Service Settings
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    AI_MODEL = os.getenv("AI_MODEL", "gpt-4o-mini")
    AI_PROVIDER = os.getenv("AI_PROVIDER", "openai")  # openai, openrouter, mock

    # CORS
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=5)
