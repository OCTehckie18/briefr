from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Briefr application configuration — loads from .env file."""

    # MongoDB
    MONGO_URI: str = "mongodb://localhost:27017"
    MONGO_DB_NAME: str = "briefr"

    # JWT Auth
    JWT_SECRET: str = "change-me-in-production-32-chars-min"
    JWT_REFRESH_SECRET: str = "change-me-refresh-secret-32-chars"
    JWT_ALGORITHM: str = "HS256"

    # LLM — Groq
    LLM_API_KEY: str = ""
    # Groq deprecated llama-3.3-70b-versatile in August 2026.
    LLM_MODEL: str = "openai/gpt-oss-120b"
    LLM_FALLBACK_MODEL: str = "openai/gpt-oss-120b"

    # Email / SMTP
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""

    # Frontend URL (for CORS)
    FRONTEND_URL: str = "http://localhost:5173"

    # Internal meeting bot service URLs
    BOT_SERVICE_URL: str = "http://localhost:3001"
    BACKEND_SERVICE_URL: str = "http://localhost:8000"
    BOT_TOKEN_TTL_MINUTES: int = 180
    BOT_LOOKBACK_MINUTES: int = 15

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
