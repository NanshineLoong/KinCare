from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


def _normalize_time(value: str) -> str:
    cleaned = value.strip()
    parts = cleaned.split(":")
    if len(parts) != 2:
        raise ValueError("Time must use HH:MM format.")

    try:
        hour = int(parts[0])
        minute = int(parts[1])
    except ValueError as error:
        raise ValueError("Time must use HH:MM format.") from error

    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        raise ValueError("Time must be within 00:00-23:59.")
    return f"{hour:02d}:{minute:02d}"


def _normalize_required_text(value: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError("Field is required.")
    return cleaned


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


class ChatModelSettingsRead(BaseModel):
    base_url: str | None
    api_key: str | None
    model: str

    @field_validator("base_url", "api_key")
    @classmethod
    def validate_optional_text(cls, value: str | None) -> str | None:
        return _normalize_optional_text(value)

    @field_validator("model")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        return _normalize_required_text(value)


class ChatModelSettingsUpdate(BaseModel):
    base_url: str | None = None
    api_key: str | None = None
    model: str | None = None

    @field_validator("base_url", "api_key", "model")
    @classmethod
    def validate_optional_text(cls, value: str | None) -> str | None:
        return _normalize_optional_text(value)


class TranscriptionSettingsRead(BaseModel):
    provider: Literal["openai", "local_whisper"]
    api_key: str | None
    model: str
    language: str | None
    timeout: float = Field(gt=0)
    local_whisper_model: str
    local_whisper_device: str
    local_whisper_compute_type: str
    local_whisper_download_root: str | None

    @field_validator("api_key", "language", "local_whisper_download_root")
    @classmethod
    def validate_optional_text(cls, value: str | None) -> str | None:
        return _normalize_optional_text(value)

    @classmethod
    def validate_required_text(cls, value: str) -> str:
        return _normalize_required_text(value)

    _validate_model = field_validator("model")(validate_required_text)
    _validate_local_whisper_model = field_validator("local_whisper_model")(validate_required_text)
    _validate_local_whisper_device = field_validator("local_whisper_device")(validate_required_text)
    _validate_local_whisper_compute_type = field_validator("local_whisper_compute_type")(validate_required_text)


class TranscriptionSettingsUpdate(BaseModel):
    provider: Literal["openai", "local_whisper"] | None = None
    api_key: str | None = None
    model: str | None = None
    language: str | None = None
    timeout: float | None = Field(default=None, gt=0)
    local_whisper_model: str | None = None
    local_whisper_device: str | None = None
    local_whisper_compute_type: str | None = None
    local_whisper_download_root: str | None = None

    @field_validator(
        "api_key",
        "model",
        "language",
        "local_whisper_model",
        "local_whisper_device",
        "local_whisper_compute_type",
        "local_whisper_download_root",
    )
    @classmethod
    def validate_optional_text(cls, value: str | None) -> str | None:
        return _normalize_optional_text(value)


class AdminSettingsRead(BaseModel):
    health_summary_refresh_time: str
    care_plan_refresh_time: str
    transcription: TranscriptionSettingsRead
    chat_model: ChatModelSettingsRead

    @field_validator("health_summary_refresh_time", "care_plan_refresh_time")
    @classmethod
    def validate_time(cls, value: str) -> str:
        return _normalize_time(value)


class LocalWhisperModelStatusRead(BaseModel):
    present: bool
    resolved_path: str | None = None
    huggingface_repo_id: str | None = None
    message: str | None = None


class LocalWhisperModelDownloadRequest(BaseModel):
    model: str
    download_root: str | None = None

    @field_validator("model")
    @classmethod
    def validate_model(cls, value: str) -> str:
        return _normalize_required_text(value)

    @field_validator("download_root")
    @classmethod
    def validate_download_root(cls, value: str | None) -> str | None:
        return _normalize_optional_text(value)


class AdminSettingsUpdate(BaseModel):
    health_summary_refresh_time: str | None = None
    care_plan_refresh_time: str | None = None
    transcription: TranscriptionSettingsUpdate | None = None
    chat_model: ChatModelSettingsUpdate | None = None

    @field_validator("health_summary_refresh_time", "care_plan_refresh_time")
    @classmethod
    def validate_optional_time(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _normalize_time(value)
