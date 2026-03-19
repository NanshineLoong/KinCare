from __future__ import annotations

import sqlite3

from app.core.config import Settings
from app.core.database import Database
from app.services.repository import now_iso


HEALTH_SUMMARY_REFRESH_TIME_KEY = "health_summary_refresh_time"
CARE_PLAN_REFRESH_TIME_KEY = "care_plan_refresh_time"
TIME_SETTING_KEYS = (
    HEALTH_SUMMARY_REFRESH_TIME_KEY,
    CARE_PLAN_REFRESH_TIME_KEY,
)


def _default_time(hour: int, minute: int) -> str:
    return f"{hour:02d}:{minute:02d}"


def _load_time_settings(
    connection: sqlite3.Connection,
    *,
    settings: Settings,
) -> dict[str, str]:
    rows = connection.execute(
        """
        SELECT key, value
        FROM system_config
        WHERE key IN (?, ?)
        """,
        TIME_SETTING_KEYS,
    ).fetchall()
    values = {str(row["key"]): str(row["value"]) for row in rows}
    return {
        HEALTH_SUMMARY_REFRESH_TIME_KEY: values.get(
            HEALTH_SUMMARY_REFRESH_TIME_KEY,
            _default_time(
                settings.health_summary_refresh_hour,
                settings.health_summary_refresh_minute,
            ),
        ),
        CARE_PLAN_REFRESH_TIME_KEY: values.get(
            CARE_PLAN_REFRESH_TIME_KEY,
            _default_time(
                settings.care_plan_refresh_hour,
                settings.care_plan_refresh_minute,
            ),
        ),
    }


def get_admin_settings(database: Database, settings: Settings) -> dict[str, str]:
    with database.connection() as connection:
        return _load_time_settings(connection, settings=settings)


def update_admin_settings(
    database: Database,
    settings: Settings,
    *,
    health_summary_refresh_time: str,
    care_plan_refresh_time: str,
) -> dict[str, str]:
    updated_at = now_iso()
    with database.connection() as connection:
        connection.executemany(
            """
            INSERT INTO system_config (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = excluded.updated_at
            """,
            [
                (
                    HEALTH_SUMMARY_REFRESH_TIME_KEY,
                    health_summary_refresh_time,
                    updated_at,
                ),
                (
                    CARE_PLAN_REFRESH_TIME_KEY,
                    care_plan_refresh_time,
                    updated_at,
                ),
            ],
        )
        return _load_time_settings(connection, settings=settings)
