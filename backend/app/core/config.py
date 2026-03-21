from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


@dataclass(frozen=True)
class Settings:
    database_path: str
    jwt_secret: str
    access_token_ttl_seconds: int
    refresh_token_ttl_seconds: int
    remember_me_refresh_token_ttl_seconds: int
    cors_origins: tuple[str, ...]
    ai_base_url: str | None
    ai_api_key: str | None
    ai_model: str
    stt_provider: str
    stt_base_url: str | None
    stt_api_key: str | None
    stt_base_url_uses_ai_fallback: bool
    stt_api_key_uses_ai_fallback: bool
    stt_model: str
    stt_language: str | None
    stt_prompt: str | None
    stt_timeout_seconds: float
    local_whisper_model: str
    local_whisper_device: str
    local_whisper_compute_type: str
    local_whisper_download_root: str | None
    docling_artifacts_path: str | None
    scheduler_enabled: bool
    scheduler_timezone: str
    health_summary_refresh_hour: int
    health_summary_refresh_minute: int
    care_plan_refresh_hour: int
    care_plan_refresh_minute: int


def get_settings() -> Settings:
    backend_root = Path(__file__).resolve().parents[2]
    repo_root = backend_root.parent
    if os.getenv("KINCARE_SKIP_DOTENV", "0") != "1":
        load_dotenv(repo_root / ".env", override=False)
    default_database_path = backend_root / "data" / "kincare.db"
    cors_origins = os.getenv(
        "KINCARE_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    )

    raw_ai_base_url = os.getenv("KINCARE_AI_BASE_URL")
    raw_ai_api_key = os.getenv("KINCARE_AI_API_KEY")
    raw_stt_base_url = os.getenv("KINCARE_STT_BASE_URL")
    raw_stt_api_key = os.getenv("KINCARE_STT_API_KEY")

    return Settings(
        database_path=os.getenv("KINCARE_DB_PATH", str(default_database_path)),
        jwt_secret=os.getenv("KINCARE_JWT_SECRET", "change-me-in-production"),
        access_token_ttl_seconds=int(os.getenv("KINCARE_ACCESS_TOKEN_TTL_SECONDS", "1800")),
        refresh_token_ttl_seconds=int(os.getenv("KINCARE_REFRESH_TOKEN_TTL_SECONDS", "1209600")),
        remember_me_refresh_token_ttl_seconds=int(
            os.getenv("KINCARE_REMEMBER_ME_REFRESH_TOKEN_TTL_SECONDS", "2592000")
        ),
        cors_origins=tuple(origin.strip() for origin in cors_origins.split(",") if origin.strip()),
        ai_base_url=raw_ai_base_url,
        ai_api_key=raw_ai_api_key,
        ai_model=os.getenv("KINCARE_AI_MODEL", "gpt-4.1-mini"),
        stt_provider=os.getenv("KINCARE_STT_PROVIDER", "openai"),
        stt_base_url=raw_stt_base_url or raw_ai_base_url,
        stt_api_key=raw_stt_api_key or raw_ai_api_key,
        stt_base_url_uses_ai_fallback=raw_stt_base_url is None,
        stt_api_key_uses_ai_fallback=raw_stt_api_key is None,
        stt_model=os.getenv("KINCARE_STT_MODEL", "gpt-4o-mini-transcribe"),
        stt_language=os.getenv("KINCARE_STT_LANGUAGE", "zh"),
        stt_prompt=os.getenv("KINCARE_STT_PROMPT"),
        stt_timeout_seconds=float(os.getenv("KINCARE_STT_TIMEOUT_SECONDS", "30")),
        local_whisper_model=os.getenv("KINCARE_LOCAL_WHISPER_MODEL", "small"),
        local_whisper_device=os.getenv("KINCARE_LOCAL_WHISPER_DEVICE", "auto"),
        local_whisper_compute_type=os.getenv("KINCARE_LOCAL_WHISPER_COMPUTE_TYPE", "default"),
        local_whisper_download_root=os.getenv("KINCARE_LOCAL_WHISPER_DOWNLOAD_ROOT") or None,
        docling_artifacts_path=os.getenv("KINCARE_DOCLING_ARTIFACTS_PATH"),
        scheduler_enabled=os.getenv("KINCARE_SCHEDULER_ENABLED", "1") == "1",
        scheduler_timezone=os.getenv("KINCARE_SCHEDULER_TIMEZONE", "Asia/Shanghai"),
        health_summary_refresh_hour=int(os.getenv("KINCARE_HEALTH_SUMMARY_REFRESH_HOUR", "5")),
        health_summary_refresh_minute=int(os.getenv("KINCARE_HEALTH_SUMMARY_REFRESH_MINUTE", "0")),
        care_plan_refresh_hour=int(os.getenv("KINCARE_CARE_PLAN_REFRESH_HOUR", "6")),
        care_plan_refresh_minute=int(os.getenv("KINCARE_CARE_PLAN_REFRESH_MINUTE", "0")),
    )
