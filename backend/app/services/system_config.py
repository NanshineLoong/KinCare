from __future__ import annotations

from dataclasses import replace
import sqlite3
from typing import Any, Literal

from app.core.config import Settings
from app.core.database import Database
from app.services.repository import now_iso


HEALTH_SUMMARY_REFRESH_TIME_KEY = "health_summary_refresh_time"
CARE_PLAN_REFRESH_TIME_KEY = "care_plan_refresh_time"
TIME_SETTING_KEYS = (
    HEALTH_SUMMARY_REFRESH_TIME_KEY,
    CARE_PLAN_REFRESH_TIME_KEY,
)
AI_BASE_URL_KEY = "ai_base_url"
AI_API_KEY_KEY = "ai_api_key"
AI_MODEL_KEY = "ai_model"
STT_PROVIDER_KEY = "stt_provider"
STT_API_KEY_KEY = "stt_api_key"
STT_MODEL_KEY = "stt_model"
STT_LANGUAGE_KEY = "stt_language"
STT_TIMEOUT_KEY = "stt_timeout_seconds"
LOCAL_WHISPER_MODEL_KEY = "local_whisper_model"
LOCAL_WHISPER_DEVICE_KEY = "local_whisper_device"
LOCAL_WHISPER_COMPUTE_TYPE_KEY = "local_whisper_compute_type"
LOCAL_WHISPER_DOWNLOAD_ROOT_KEY = "local_whisper_download_root"
AI_DEFAULT_LANGUAGE_KEY = "ai_default_language"
DEFAULT_AI_OUTPUT_LANGUAGE = "en"
AI_SETTING_KEYS = (
    AI_BASE_URL_KEY,
    AI_API_KEY_KEY,
    AI_MODEL_KEY,
    AI_DEFAULT_LANGUAGE_KEY,
    STT_PROVIDER_KEY,
    STT_API_KEY_KEY,
    STT_MODEL_KEY,
    STT_LANGUAGE_KEY,
    STT_TIMEOUT_KEY,
    LOCAL_WHISPER_MODEL_KEY,
    LOCAL_WHISPER_DEVICE_KEY,
    LOCAL_WHISPER_COMPUTE_TYPE_KEY,
    LOCAL_WHISPER_DOWNLOAD_ROOT_KEY,
)
ALL_SETTING_KEYS = TIME_SETTING_KEYS + AI_SETTING_KEYS


def _default_time(hour: int, minute: int) -> str:
    return f"{hour:02d}:{minute:02d}"


def _load_time_settings(
    connection: sqlite3.Connection,
    *,
    settings: Settings,
    values: dict[str, str] | None = None,
) -> dict[str, str]:
    loaded_values = values if values is not None else _load_setting_values(connection)
    return {
        HEALTH_SUMMARY_REFRESH_TIME_KEY: loaded_values.get(
            HEALTH_SUMMARY_REFRESH_TIME_KEY,
            _default_time(
                settings.health_summary_refresh_hour,
                settings.health_summary_refresh_minute,
            ),
        ),
        CARE_PLAN_REFRESH_TIME_KEY: loaded_values.get(
            CARE_PLAN_REFRESH_TIME_KEY,
            _default_time(
                settings.care_plan_refresh_hour,
                settings.care_plan_refresh_minute,
            ),
        ),
    }


def _load_setting_values(connection: sqlite3.Connection) -> dict[str, str]:
    placeholders = ", ".join("?" for _ in ALL_SETTING_KEYS)
    rows = connection.execute(
        f"""
        SELECT key, value
        FROM system_config
        WHERE key IN ({placeholders})
        """,
        ALL_SETTING_KEYS,
    ).fetchall()
    return {str(row["key"]): str(row["value"]) for row in rows}


def _effective_setting_value(
    values: dict[str, str],
    *,
    settings: Settings,
    key: str,
) -> str | None:
    if key == AI_BASE_URL_KEY:
        return values.get(AI_BASE_URL_KEY, settings.ai_base_url)
    if key == AI_API_KEY_KEY:
        return values.get(AI_API_KEY_KEY, settings.ai_api_key)
    if key == AI_MODEL_KEY:
        return values.get(AI_MODEL_KEY, settings.ai_model)
    if key == STT_PROVIDER_KEY:
        return values.get(STT_PROVIDER_KEY, settings.stt_provider)
    if key == STT_API_KEY_KEY:
        if STT_API_KEY_KEY in values:
            return values[STT_API_KEY_KEY]
        if settings.stt_api_key_uses_ai_fallback:
            return values.get(AI_API_KEY_KEY, settings.ai_api_key)
        return settings.stt_api_key
    if key == STT_MODEL_KEY:
        return values.get(STT_MODEL_KEY, settings.stt_model)
    if key == STT_LANGUAGE_KEY:
        return values.get(STT_LANGUAGE_KEY, settings.stt_language)
    if key == LOCAL_WHISPER_MODEL_KEY:
        return values.get(LOCAL_WHISPER_MODEL_KEY, settings.local_whisper_model)
    if key == LOCAL_WHISPER_DEVICE_KEY:
        return values.get(LOCAL_WHISPER_DEVICE_KEY, settings.local_whisper_device)
    if key == LOCAL_WHISPER_COMPUTE_TYPE_KEY:
        return values.get(LOCAL_WHISPER_COMPUTE_TYPE_KEY, settings.local_whisper_compute_type)
    if key == LOCAL_WHISPER_DOWNLOAD_ROOT_KEY:
        return values.get(LOCAL_WHISPER_DOWNLOAD_ROOT_KEY, settings.local_whisper_download_root)
    raise KeyError(key)


def _effective_stt_base_url(values: dict[str, str], settings: Settings) -> str | None:
    if settings.stt_base_url_uses_ai_fallback:
        return values.get(AI_BASE_URL_KEY, settings.ai_base_url)
    return settings.stt_base_url


def _field_source(
    values: dict[str, str],
    key: str,
    env_value: str | None,
) -> tuple[str | None, Literal["env", "db"] | None]:
    """Returns (value_to_send, source). Never exposes env-sourced values."""
    if key in values:
        return values[key] or None, "db"
    if env_value:
        return None, "env"
    return None, None


def _stt_api_key_field_source(
    values: dict[str, str],
    settings: Settings,
) -> tuple[str | None, Literal["env", "db"] | None]:
    """Handles the STT api_key fallback chain through ai_api_key."""
    if STT_API_KEY_KEY in values:
        return values[STT_API_KEY_KEY] or None, "db"
    if settings.stt_api_key_uses_ai_fallback:
        return _field_source(values, AI_API_KEY_KEY, settings.ai_api_key)
    if settings.stt_api_key:
        return None, "env"
    return None, None


def load_runtime_settings(database: Database, settings: Settings) -> Settings:
    with database.connection() as connection:
        values = _load_setting_values(connection)
    return _load_runtime_settings_from_values(values, settings=settings)


def _load_runtime_settings_from_values(
    values: dict[str, str],
    *,
    settings: Settings,
) -> Settings:
    stt_timeout_value = values.get(STT_TIMEOUT_KEY)
    stt_timeout_seconds = (
        float(stt_timeout_value)
        if stt_timeout_value is not None
        else settings.stt_timeout_seconds
    )
    return replace(
        settings,
        ai_base_url=_effective_setting_value(values, settings=settings, key=AI_BASE_URL_KEY),
        ai_api_key=_effective_setting_value(values, settings=settings, key=AI_API_KEY_KEY),
        ai_model=_effective_setting_value(values, settings=settings, key=AI_MODEL_KEY) or settings.ai_model,
        stt_provider=_effective_setting_value(values, settings=settings, key=STT_PROVIDER_KEY) or settings.stt_provider,
        stt_base_url=_effective_stt_base_url(values, settings),
        stt_api_key=_effective_setting_value(values, settings=settings, key=STT_API_KEY_KEY),
        stt_model=_effective_setting_value(values, settings=settings, key=STT_MODEL_KEY) or settings.stt_model,
        stt_language=_effective_setting_value(values, settings=settings, key=STT_LANGUAGE_KEY),
        stt_timeout_seconds=stt_timeout_seconds,
        local_whisper_model=_effective_setting_value(values, settings=settings, key=LOCAL_WHISPER_MODEL_KEY)
        or settings.local_whisper_model,
        local_whisper_device=_effective_setting_value(values, settings=settings, key=LOCAL_WHISPER_DEVICE_KEY)
        or settings.local_whisper_device,
        local_whisper_compute_type=_effective_setting_value(
            values,
            settings=settings,
            key=LOCAL_WHISPER_COMPUTE_TYPE_KEY,
        )
        or settings.local_whisper_compute_type,
        local_whisper_download_root=_effective_setting_value(
            values,
            settings=settings,
            key=LOCAL_WHISPER_DOWNLOAD_ROOT_KEY,
        ),
    )


def _serialize_admin_settings(
    connection: sqlite3.Connection,
    *,
    settings: Settings,
) -> dict[str, Any]:
    values = _load_setting_values(connection)
    effective_settings = _load_runtime_settings_from_values(values, settings=settings)
    time_settings = _load_time_settings(connection, settings=settings, values=values)

    chat_api_key, chat_api_key_source = _field_source(values, AI_API_KEY_KEY, settings.ai_api_key)
    chat_base_url, chat_base_url_source = _field_source(values, AI_BASE_URL_KEY, settings.ai_base_url)
    chat_model_val, chat_model_source = _field_source(values, AI_MODEL_KEY, settings.ai_model)
    stt_api_key_val, stt_api_key_source = _stt_api_key_field_source(values, settings)

    return {
        **time_settings,
        "ai_default_language": values.get(AI_DEFAULT_LANGUAGE_KEY, DEFAULT_AI_OUTPUT_LANGUAGE),
        "transcription": {
            "provider": effective_settings.stt_provider,
            "api_key": stt_api_key_val,
            "api_key_source": stt_api_key_source,
            "model": effective_settings.stt_model,
            "language": effective_settings.stt_language,
            "timeout": effective_settings.stt_timeout_seconds,
            "local_whisper_model": effective_settings.local_whisper_model,
            "local_whisper_device": effective_settings.local_whisper_device,
            "local_whisper_compute_type": effective_settings.local_whisper_compute_type,
            "local_whisper_download_root": effective_settings.local_whisper_download_root,
        },
        "chat_model": {
            "base_url": chat_base_url,
            "base_url_source": chat_base_url_source,
            "api_key": chat_api_key,
            "api_key_source": chat_api_key_source,
            "model": chat_model_val or settings.ai_model,
            "model_source": chat_model_source,
        },
    }


def get_admin_settings(database: Database, settings: Settings) -> dict[str, Any]:
    with database.connection() as connection:
        return _serialize_admin_settings(connection, settings=settings)


def get_ai_default_language(connection: sqlite3.Connection) -> str:
    values = _load_setting_values(connection)
    return values.get(AI_DEFAULT_LANGUAGE_KEY, DEFAULT_AI_OUTPUT_LANGUAGE)


def _upsert_config_values(
    connection: sqlite3.Connection,
    *,
    values: dict[str, str],
    updated_at: str,
) -> None:
    if not values:
        return
    connection.executemany(
        """
        INSERT INTO system_config (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = excluded.updated_at
        """,
        [(key, value, updated_at) for key, value in values.items()],
    )


def _delete_config_keys(connection: sqlite3.Connection, *, keys: list[str]) -> None:
    if not keys:
        return
    placeholders = ", ".join("?" for _ in keys)
    connection.execute(
        f"DELETE FROM system_config WHERE key IN ({placeholders})",
        keys,
    )


def update_admin_settings(
    database: Database,
    settings: Settings,
    *,
    payload: dict[str, Any],
) -> dict[str, Any]:
    updated_at = now_iso()
    to_upsert: dict[str, str] = {}
    to_delete: list[str] = []

    if "health_summary_refresh_time" in payload and payload["health_summary_refresh_time"] is not None:
        to_upsert[HEALTH_SUMMARY_REFRESH_TIME_KEY] = str(payload["health_summary_refresh_time"])
    if "care_plan_refresh_time" in payload and payload["care_plan_refresh_time"] is not None:
        to_upsert[CARE_PLAN_REFRESH_TIME_KEY] = str(payload["care_plan_refresh_time"])
    if "ai_default_language" in payload:
        value = payload["ai_default_language"]
        if value is None:
            to_delete.append(AI_DEFAULT_LANGUAGE_KEY)
        else:
            to_upsert[AI_DEFAULT_LANGUAGE_KEY] = str(value)

    transcription_updates = payload.get("transcription") or {}
    transcription_key_map = {
        "provider": STT_PROVIDER_KEY,
        "api_key": STT_API_KEY_KEY,
        "model": STT_MODEL_KEY,
        "language": STT_LANGUAGE_KEY,
        "timeout": STT_TIMEOUT_KEY,
        "local_whisper_model": LOCAL_WHISPER_MODEL_KEY,
        "local_whisper_device": LOCAL_WHISPER_DEVICE_KEY,
        "local_whisper_compute_type": LOCAL_WHISPER_COMPUTE_TYPE_KEY,
        "local_whisper_download_root": LOCAL_WHISPER_DOWNLOAD_ROOT_KEY,
    }
    for field_name, key in transcription_key_map.items():
        if field_name not in transcription_updates:
            continue
        value = transcription_updates[field_name]
        if value is None:
            if key == LOCAL_WHISPER_DOWNLOAD_ROOT_KEY:
                to_upsert[key] = ""
                continue
            to_delete.append(key)
        else:
            to_upsert[key] = str(value)

    chat_model_updates = payload.get("chat_model") or {}
    chat_model_key_map = {
        "base_url": AI_BASE_URL_KEY,
        "api_key": AI_API_KEY_KEY,
        "model": AI_MODEL_KEY,
    }
    for field_name, key in chat_model_key_map.items():
        if field_name not in chat_model_updates:
            continue
        value = chat_model_updates[field_name]
        if value is None:
            to_delete.append(key)
        else:
            to_upsert[key] = str(value)

    with database.connection() as connection:
        _delete_config_keys(connection, keys=to_delete)
        _upsert_config_values(connection, values=to_upsert, updated_at=updated_at)
        return _serialize_admin_settings(connection, settings=settings)
