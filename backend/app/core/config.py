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


def get_settings() -> Settings:
    backend_root = Path(__file__).resolve().parents[2]
    default_database_path = backend_root / "data" / "homevital.db"
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
    )
