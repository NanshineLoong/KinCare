from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import UTC, date, datetime, time, timedelta
from typing import Any

from app.services.repository import now_iso


WEEKDAY_MAP = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}


def _serialize_json(value: dict[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=False)


def _parse_json(value: str) -> dict[str, Any]:
    return dict(json.loads(value))


def task_from_row(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    item["schedule_config"] = _parse_json(item["schedule_config"])
    item["enabled"] = bool(item["enabled"])
    return item


def compute_next_run_at(schedule_type: str, schedule_config: dict[str, Any], *, now: datetime | None = None) -> str | None:
    current = now or datetime.now(UTC)

    if schedule_type == "once":
        value = schedule_config.get("run_at")
        return str(value) if value else None

    hour = int(schedule_config.get("hour", 0))
    minute = int(schedule_config.get("minute", 0))
    target_time = time(hour=hour, minute=minute, tzinfo=UTC)

    if schedule_type == "daily":
        candidate = datetime.combine(current.date(), target_time)
        if candidate <= current:
            candidate = candidate + timedelta(days=1)
        return candidate.isoformat()

    weekday_value = str(schedule_config.get("weekday", "monday")).lower()
    weekday = WEEKDAY_MAP.get(weekday_value, 0)
    delta_days = (weekday - current.weekday()) % 7
    candidate_date = current.date() + timedelta(days=delta_days)
    candidate = datetime.combine(candidate_date, target_time)
    if candidate <= current:
        candidate = candidate + timedelta(days=7)
    return candidate.isoformat()


def create_task(
    connection: sqlite3.Connection,
    *,
    family_space_id: str,
    member_id: str | None,
    created_by: str,
    task_type: str,
    prompt: str,
    schedule_type: str,
    schedule_config: dict[str, Any],
    enabled: bool = True,
) -> dict[str, Any]:
    timestamp = now_iso()
    record = {
        "id": str(uuid.uuid4()),
        "family_space_id": family_space_id,
        "member_id": member_id,
        "created_by": created_by,
        "task_type": task_type,
        "prompt": prompt,
        "schedule_type": schedule_type,
        "schedule_config": _serialize_json(schedule_config),
        "enabled": 1 if enabled else 0,
        "next_run_at": compute_next_run_at(schedule_type, schedule_config),
        "last_run_at": None,
        "last_error": None,
        "created_at": timestamp,
        "updated_at": timestamp,
    }
    connection.execute(
        """
        INSERT INTO scheduled_task (
            id, family_space_id, member_id, created_by, task_type, prompt, schedule_type,
            schedule_config, enabled, next_run_at, last_run_at, last_error, created_at, updated_at
        ) VALUES (
            :id, :family_space_id, :member_id, :created_by, :task_type, :prompt, :schedule_type,
            :schedule_config, :enabled, :next_run_at, :last_run_at, :last_error, :created_at, :updated_at
        )
        """,
        record,
    )
    return get_task_by_id(connection, record["id"])


def get_task_by_id(connection: sqlite3.Connection, task_id: str) -> dict[str, Any] | None:
    row = connection.execute("SELECT * FROM scheduled_task WHERE id = ?", (task_id,)).fetchone()
    return task_from_row(row) if row else None


def list_enabled_tasks(connection: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT *
        FROM scheduled_task
        WHERE enabled = 1
        ORDER BY CASE WHEN next_run_at IS NULL THEN 1 ELSE 0 END, next_run_at ASC, created_at ASC
        """
    ).fetchall()
    return [task_from_row(row) for row in rows]


def update_task(
    connection: sqlite3.Connection,
    task_id: str,
    changes: dict[str, Any],
) -> dict[str, Any]:
    stored_changes: dict[str, Any] = {}
    for key, value in changes.items():
        if key == "schedule_config" and value is not None:
            stored_changes[key] = _serialize_json(value)
        elif key == "enabled":
            stored_changes[key] = 1 if value else 0
        else:
            stored_changes[key] = value
    stored_changes["updated_at"] = now_iso()
    stored_changes["id"] = task_id
    assignments = ", ".join(f"{key} = :{key}" for key in stored_changes if key != "id")
    connection.execute(
        f"UPDATE scheduled_task SET {assignments} WHERE id = :id",
        stored_changes,
    )
    return get_task_by_id(connection, task_id)


def mark_task_run(
    connection: sqlite3.Connection,
    task_id: str,
    *,
    error: str | None = None,
) -> dict[str, Any]:
    task = get_task_by_id(connection, task_id)
    if task is None:
        raise KeyError(task_id)

    next_run_at = None
    if task["enabled"]:
        next_run_at = compute_next_run_at(task["schedule_type"], task["schedule_config"])

    return update_task(
        connection,
        task_id,
        {
            "last_run_at": now_iso(),
            "last_error": error,
            "next_run_at": next_run_at,
        },
    )
