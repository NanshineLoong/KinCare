from __future__ import annotations

import json
import sqlite3
import uuid
from typing import Any

from app.services.repository import now_iso


def _parse_json(value: str | None) -> dict[str, Any] | None:
    if not value:
        return None
    return dict(json.loads(value))


def _serialize_json(value: dict[str, Any] | None) -> str | None:
    if value is None:
        return None
    return json.dumps(value, ensure_ascii=False)


def session_from_row(row: sqlite3.Row) -> dict[str, Any]:
    return dict(row)


def message_from_row(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    item["metadata"] = _parse_json(item.get("metadata"))
    return item


def create_session(
    connection: sqlite3.Connection,
    *,
    user_id: str,
    family_space_id: str,
    member_id: str | None,
    page_context: str | None,
    title: str | None = None,
) -> dict[str, Any]:
    timestamp = now_iso()
    record = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "family_space_id": family_space_id,
        "member_id": member_id,
        "title": title,
        "page_context": page_context,
        "created_at": timestamp,
        "updated_at": timestamp,
    }
    connection.execute(
        """
        INSERT INTO chat_session (
            id, user_id, family_space_id, member_id, title, page_context, created_at, updated_at
        ) VALUES (
            :id, :user_id, :family_space_id, :member_id, :title, :page_context, :created_at, :updated_at
        )
        """,
        record,
    )
    return record


def get_session_by_id(connection: sqlite3.Connection, session_id: str) -> dict[str, Any] | None:
    row = connection.execute("SELECT * FROM chat_session WHERE id = ?", (session_id,)).fetchone()
    return session_from_row(row) if row else None


def touch_session(connection: sqlite3.Connection, session_id: str) -> None:
    connection.execute(
        "UPDATE chat_session SET updated_at = ? WHERE id = ?",
        (now_iso(), session_id),
    )


def create_message(
    connection: sqlite3.Connection,
    *,
    session_id: str,
    role: str,
    content: str,
    event_type: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    record = {
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "role": role,
        "content": content,
        "event_type": event_type,
        "metadata": _serialize_json(metadata),
        "created_at": now_iso(),
    }
    connection.execute(
        """
        INSERT INTO chat_message (id, session_id, role, content, event_type, metadata, created_at)
        VALUES (:id, :session_id, :role, :content, :event_type, :metadata, :created_at)
        """,
        record,
    )
    touch_session(connection, session_id)
    return {
        **record,
        "metadata": metadata,
    }


def list_messages_for_session(connection: sqlite3.Connection, session_id: str) -> list[dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT *
        FROM chat_message
        WHERE session_id = ?
        ORDER BY created_at ASC
        """,
        (session_id,),
    ).fetchall()
    return [message_from_row(row) for row in rows]
