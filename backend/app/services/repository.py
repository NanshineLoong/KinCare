from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import UTC, datetime
from typing import Any


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _serialize_json_list(value: list[str] | None) -> str:
    return json.dumps(value or [], ensure_ascii=False)


def _parse_json_list(value: str | None) -> list[str]:
    if not value:
        return []
    return list(json.loads(value))


def family_space_from_row(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "created_at": row["created_at"],
    }


def user_from_row(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "family_space_id": row["family_space_id"],
        "email": row["email"],
        "password_hash": row["password_hash"],
        "role": row["role"],
        "created_at": row["created_at"],
        "member_id": row["member_id"],
    }


def member_from_row(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "family_space_id": row["family_space_id"],
        "user_account_id": row["user_account_id"],
        "name": row["name"],
        "gender": row["gender"],
        "birth_date": row["birth_date"],
        "blood_type": row["blood_type"],
        "allergies": _parse_json_list(row["allergies"]),
        "medical_history": _parse_json_list(row["medical_history"]),
        "avatar_url": row["avatar_url"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def count_users(connection: sqlite3.Connection) -> int:
    row = connection.execute("SELECT COUNT(*) AS total FROM user_account").fetchone()
    return int(row["total"])


def get_family_space(connection: sqlite3.Connection) -> dict[str, Any] | None:
    row = connection.execute(
        "SELECT id, name, created_at FROM family_space ORDER BY created_at ASC LIMIT 1"
    ).fetchone()
    return family_space_from_row(row) if row else None


def create_family_space(connection: sqlite3.Connection, *, name: str) -> dict[str, Any]:
    record = {
        "id": str(uuid.uuid4()),
        "name": name,
        "created_at": now_iso(),
    }
    connection.execute(
        """
        INSERT INTO family_space (id, name, created_at)
        VALUES (:id, :name, :created_at)
        """,
        record,
    )
    return record


def get_user_by_email(connection: sqlite3.Connection, email: str) -> dict[str, Any] | None:
    row = connection.execute(
        """
        SELECT
            ua.id,
            ua.family_space_id,
            ua.email,
            ua.password_hash,
            ua.role,
            ua.created_at,
            fm.id AS member_id
        FROM user_account AS ua
        LEFT JOIN family_member AS fm ON fm.user_account_id = ua.id
        WHERE ua.email = ?
        """,
        (email,),
    ).fetchone()
    return user_from_row(row) if row else None


def get_user_by_id(connection: sqlite3.Connection, user_id: str) -> dict[str, Any] | None:
    row = connection.execute(
        """
        SELECT
            ua.id,
            ua.family_space_id,
            ua.email,
            ua.password_hash,
            ua.role,
            ua.created_at,
            fm.id AS member_id
        FROM user_account AS ua
        LEFT JOIN family_member AS fm ON fm.user_account_id = ua.id
        WHERE ua.id = ?
        """,
        (user_id,),
    ).fetchone()
    return user_from_row(row) if row else None


def create_user(
    connection: sqlite3.Connection,
    *,
    family_space_id: str,
    email: str,
    password_hash: str,
    role: str,
) -> dict[str, Any]:
    record = {
        "id": str(uuid.uuid4()),
        "family_space_id": family_space_id,
        "email": email,
        "password_hash": password_hash,
        "role": role,
        "created_at": now_iso(),
    }
    connection.execute(
        """
        INSERT INTO user_account (id, family_space_id, email, password_hash, role, created_at)
        VALUES (:id, :family_space_id, :email, :password_hash, :role, :created_at)
        """,
        record,
    )
    record["member_id"] = None
    return record


def create_member(
    connection: sqlite3.Connection,
    *,
    family_space_id: str,
    name: str,
    gender: str = "unknown",
    birth_date: str | None = None,
    blood_type: str | None = None,
    allergies: list[str] | None = None,
    medical_history: list[str] | None = None,
    avatar_url: str | None = None,
    user_account_id: str | None = None,
) -> dict[str, Any]:
    timestamp = now_iso()
    record = {
        "id": str(uuid.uuid4()),
        "family_space_id": family_space_id,
        "user_account_id": user_account_id,
        "name": name,
        "gender": gender,
        "birth_date": birth_date,
        "blood_type": blood_type,
        "allergies": _serialize_json_list(allergies),
        "medical_history": _serialize_json_list(medical_history),
        "avatar_url": avatar_url,
        "created_at": timestamp,
        "updated_at": timestamp,
    }
    connection.execute(
        """
        INSERT INTO family_member (
            id,
            family_space_id,
            user_account_id,
            name,
            gender,
            birth_date,
            blood_type,
            allergies,
            medical_history,
            avatar_url,
            created_at,
            updated_at
        )
        VALUES (
            :id,
            :family_space_id,
            :user_account_id,
            :name,
            :gender,
            :birth_date,
            :blood_type,
            :allergies,
            :medical_history,
            :avatar_url,
            :created_at,
            :updated_at
        )
        """,
        record,
    )
    return get_member_by_id(connection, record["id"])


def list_members_by_family_space(connection: sqlite3.Connection, family_space_id: str) -> list[dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT *
        FROM family_member
        WHERE family_space_id = ?
        ORDER BY created_at ASC
        """,
        (family_space_id,),
    ).fetchall()
    return [member_from_row(row) for row in rows]


def get_member_by_id(connection: sqlite3.Connection, member_id: str) -> dict[str, Any] | None:
    row = connection.execute(
        "SELECT * FROM family_member WHERE id = ?",
        (member_id,),
    ).fetchone()
    return member_from_row(row) if row else None


def get_member_by_user_account_id(connection: sqlite3.Connection, user_account_id: str) -> dict[str, Any] | None:
    row = connection.execute(
        "SELECT * FROM family_member WHERE user_account_id = ?",
        (user_account_id,),
    ).fetchone()
    return member_from_row(row) if row else None


def update_member(connection: sqlite3.Connection, member_id: str, changes: dict[str, Any]) -> dict[str, Any]:
    current = get_member_by_id(connection, member_id)
    if current is None:
        raise KeyError(member_id)

    stored_changes: dict[str, Any] = {}
    for key, value in changes.items():
        if key in {"allergies", "medical_history"}:
            stored_changes[key] = _serialize_json_list(value)
        else:
            stored_changes[key] = value

    stored_changes["updated_at"] = now_iso()
    assignments = ", ".join(f"{key} = :{key}" for key in stored_changes)
    stored_changes["id"] = member_id

    connection.execute(
        f"UPDATE family_member SET {assignments} WHERE id = :id",
        stored_changes,
    )
    return get_member_by_id(connection, member_id)


def delete_member(connection: sqlite3.Connection, member_id: str) -> None:
    connection.execute("DELETE FROM family_member WHERE id = ?", (member_id,))
