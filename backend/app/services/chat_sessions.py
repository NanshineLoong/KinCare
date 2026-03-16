from __future__ import annotations

import json
import sqlite3
import uuid
from typing import Any

from app.services.repository import now_iso

SESSION_TITLE_MAX_CHARS = 48
SESSION_SUMMARY_MAX_CHARS = 120


def _parse_json(value: str | None) -> dict[str, Any] | None:
    if not value:
        return None
    return dict(json.loads(value))


def _serialize_json(value: dict[str, Any] | None) -> str | None:
    if value is None:
        return None
    return json.dumps(value, ensure_ascii=False)


def _normalize_preview_text(content: str) -> str:
    return " ".join(content.split())


def _truncate_preview(content: str, limit: int) -> str:
    if len(content) <= limit:
        return content
    return f"{content[: limit - 1].rstrip()}…"


def _build_session_preview(content: str) -> dict[str, str] | None:
    normalized = _normalize_preview_text(content)
    if not normalized:
        return None
    return {
        "title": _truncate_preview(normalized, SESSION_TITLE_MAX_CHARS),
        "summary": _truncate_preview(normalized, SESSION_SUMMARY_MAX_CHARS),
    }


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
        "summary": None,
        "page_context": page_context,
        "created_at": timestamp,
        "updated_at": timestamp,
    }
    connection.execute(
        """
        INSERT INTO chat_session (
            id, user_id, family_space_id, member_id, title, summary, page_context, created_at, updated_at
        ) VALUES (
            :id, :user_id, :family_space_id, :member_id, :title, :summary, :page_context, :created_at, :updated_at
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


def list_sessions(
    connection: sqlite3.Connection,
    *,
    user_id: str,
    family_space_id: str,
    limit: int,
    offset: int,
) -> list[dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT *
        FROM chat_session
        WHERE user_id = ? AND family_space_id = ?
        ORDER BY updated_at DESC, created_at DESC
        LIMIT ? OFFSET ?
        """,
        (user_id, family_space_id, limit, offset),
    ).fetchall()
    return [session_from_row(row) for row in rows]


def update_session_summary(
    connection: sqlite3.Connection,
    session_id: str,
    summary: str,
    *,
    title: str | None = None,
    touch: bool = True,
) -> dict[str, Any]:
    session = get_session_by_id(connection, session_id)
    if session is None:
        raise KeyError(session_id)

    assignments = ["summary = :summary"]
    params: dict[str, Any] = {
        "id": session_id,
        "summary": summary,
    }
    if title is not None:
        assignments.append("title = :title")
        params["title"] = title
    if touch:
        assignments.append("updated_at = :updated_at")
        params["updated_at"] = now_iso()

    connection.execute(
        f"UPDATE chat_session SET {', '.join(assignments)} WHERE id = :id",
        params,
    )
    return get_session_by_id(connection, session_id)


def _maybe_populate_session_preview(connection: sqlite3.Connection, session_id: str, content: str) -> None:
    session = get_session_by_id(connection, session_id)
    if session is None:
        return
    if session.get("title") and session.get("summary"):
        return

    preview = _build_session_preview(content)
    if preview is None:
        return

    update_session_summary(
        connection,
        session_id,
        session.get("summary") or preview["summary"],
        title=session.get("title") or preview["title"],
        touch=False,
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
    if role == "user":
        _maybe_populate_session_preview(connection, session_id, content)
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
