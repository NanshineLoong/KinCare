from __future__ import annotations

from pydantic import BaseModel, field_validator


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


class AdminSettingsBase(BaseModel):
    health_summary_refresh_time: str
    care_plan_refresh_time: str

    @field_validator("health_summary_refresh_time", "care_plan_refresh_time")
    @classmethod
    def validate_time(cls, value: str) -> str:
        return _normalize_time(value)


class AdminSettingsRead(AdminSettingsBase):
    pass


class AdminSettingsUpdate(AdminSettingsBase):
    pass
