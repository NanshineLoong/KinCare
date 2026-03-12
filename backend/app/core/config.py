from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    database_path: str
    jwt_secret: str
    access_token_ttl_seconds: int
    refresh_token_ttl_seconds: int
    cors_origins: tuple[str, ...]
    upload_dir: str
    ai_provider: str
    ai_base_url: str | None
    ai_api_key: str | None
    ai_model: str
    scheduler_enabled: bool
    scheduler_timezone: str


def get_settings() -> Settings:
    backend_root = Path(__file__).resolve().parents[2]
    default_database_path = backend_root / "data" / "homevital.db"
    default_upload_dir = backend_root / "data" / "uploads"
    cors_origins = os.getenv(
        "HOMEVITAL_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    )

    return Settings(
        database_path=os.getenv("HOMEVITAL_DB_PATH", str(default_database_path)),
        jwt_secret=os.getenv("HOMEVITAL_JWT_SECRET", "change-me-in-production"),
        access_token_ttl_seconds=int(os.getenv("HOMEVITAL_ACCESS_TOKEN_TTL_SECONDS", "900")),
        refresh_token_ttl_seconds=int(os.getenv("HOMEVITAL_REFRESH_TOKEN_TTL_SECONDS", "604800")),
        cors_origins=tuple(origin.strip() for origin in cors_origins.split(",") if origin.strip()),
        upload_dir=os.getenv("HOMEVITAL_UPLOAD_DIR", str(default_upload_dir)),
        ai_provider=os.getenv("HOMEVITAL_AI_PROVIDER", "openai-compatible"),
        ai_base_url=os.getenv("HOMEVITAL_AI_BASE_URL"),
        ai_api_key=os.getenv("HOMEVITAL_AI_API_KEY"),
        ai_model=os.getenv("HOMEVITAL_AI_MODEL", "gpt-4.1-mini"),
        scheduler_enabled=os.getenv("HOMEVITAL_SCHEDULER_ENABLED", "1") == "1",
        scheduler_timezone=os.getenv("HOMEVITAL_SCHEDULER_TIMEZONE", "Asia/Shanghai"),
    )
