from __future__ import annotations

import json
import sqlite3
import uuid
from dataclasses import dataclass
from typing import Any

from app.services.repository import now_iso


@dataclass(frozen=True)
class ResourceConfig:
    table: str
    order_field: str
    json_fields: tuple[str, ...] = ()
    updated_at_field: str | None = "updated_at"


RESOURCE_CONFIGS: dict[str, ResourceConfig] = {
    "observations": ResourceConfig(table="observation", order_field="effective_at"),
    "conditions": ResourceConfig(table="condition", order_field="created_at"),
    "medications": ResourceConfig(table="medication", order_field="created_at"),
    "encounters": ResourceConfig(table="encounter", order_field="date"),
    "care-plans": ResourceConfig(table="care_plan", order_field="scheduled_at"),
    "sleep-records": ResourceConfig(
        table="sleep_record",
        order_field="start_at",
        updated_at_field=None,
    ),
    "workout-records": ResourceConfig(
        table="workout_record",
        order_field="start_at",
        updated_at_field=None,
    ),
    "health-summaries": ResourceConfig(
        table="health_summary",
        order_field="generated_at",
        updated_at_field=None,
    ),
}


def _serialize_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def _parse_json(value: str | None) -> Any:
    if value is None or value == "":
        return None
    return json.loads(value)


def _resource_from_row(row: sqlite3.Row, config: ResourceConfig) -> dict[str, Any]:
    item = dict(row)
    for field_name in config.json_fields:
        item[field_name] = _parse_json(item.get(field_name))
    return item


PERMISSION_LEVEL_RANK = {
    "read": 1,
    "write": 2,
    "manage": 3,
}


def _permission_from_row(row: sqlite3.Row) -> dict[str, Any]:
    return dict(row)


def get_member_access_grant(
    connection: sqlite3.Connection,
    *,
    grant_id: str,
) -> dict[str, Any] | None:
    row = connection.execute(
        """
        SELECT
            mag.*,
            ua.username AS user_username,
            ua.email AS user_email,
            ua.role AS user_role,
            fm_user.id AS user_member_id,
            fm_user.name AS user_member_name
        FROM member_access_grant AS mag
        JOIN user_account AS ua ON ua.id = mag.user_account_id
        LEFT JOIN family_member AS fm_user ON fm_user.user_account_id = ua.id
        WHERE mag.id = ?
        """,
        (grant_id,),
    ).fetchone()
    return _permission_from_row(row) if row else None


def _get_existing_member_access_grant_row(
    connection: sqlite3.Connection,
    *,
    member_id: str | None,
    user_account_id: str,
    target_scope: str,
) -> sqlite3.Row | None:
    if target_scope == "all":
        return connection.execute(
            """
            SELECT *
            FROM member_access_grant
            WHERE user_account_id = ? AND target_scope = 'all'
            """,
            (user_account_id,),
        ).fetchone()

    return connection.execute(
        """
        SELECT *
        FROM member_access_grant
        WHERE member_id = ? AND user_account_id = ? AND target_scope = 'specific'
        """,
        (member_id, user_account_id),
    ).fetchone()


def resolve_member_access_level(
    connection: sqlite3.Connection,
    *,
    member_id: str,
    user_account_id: str,
) -> str | None:
    row = connection.execute(
        """
        SELECT permission_level
        FROM member_access_grant
        WHERE user_account_id = ?
          AND (member_id = ? OR target_scope = 'all')
        ORDER BY CASE permission_level
            WHEN 'manage' THEN 3
            WHEN 'write' THEN 2
            WHEN 'read' THEN 1
            ELSE 0
        END DESC,
        CASE target_scope
            WHEN 'specific' THEN 0
            ELSE 1
        END ASC,
        created_at ASC
        LIMIT 1
        """,
        (user_account_id, member_id),
    ).fetchone()
    return str(row["permission_level"]) if row else None


def has_member_access_grant(
    connection: sqlite3.Connection,
    *,
    member_id: str,
    user_account_id: str,
    required_permission: str,
) -> bool:
    granted_permission = resolve_member_access_level(
        connection,
        member_id=member_id,
        user_account_id=user_account_id,
    )
    if granted_permission is None:
        return False
    return PERMISSION_LEVEL_RANK[granted_permission] >= PERMISSION_LEVEL_RANK[required_permission]


def has_all_scope_access_grant(
    connection: sqlite3.Connection,
    *,
    user_account_id: str,
    required_permission: str,
) -> bool:
    row = connection.execute(
        """
        SELECT permission_level
        FROM member_access_grant
        WHERE user_account_id = ? AND target_scope = 'all'
        ORDER BY CASE permission_level
            WHEN 'manage' THEN 3
            WHEN 'write' THEN 2
            WHEN 'read' THEN 1
            ELSE 0
        END DESC,
        created_at ASC
        LIMIT 1
        """,
        (user_account_id,),
    ).fetchone()
    if row is None:
        return False
    granted_permission = str(row["permission_level"])
    return PERMISSION_LEVEL_RANK[granted_permission] >= PERMISSION_LEVEL_RANK[required_permission]


def list_granted_member_ids(connection: sqlite3.Connection, user_account_id: str) -> list[str]:
    rows = connection.execute(
        """
        SELECT DISTINCT fm.id AS member_id
        FROM family_member AS fm
        JOIN user_account AS ua ON ua.family_space_id = fm.family_space_id
        WHERE ua.id = ?
          AND (
            EXISTS (
                SELECT 1
                FROM member_access_grant AS mag
                WHERE mag.user_account_id = ua.id
                  AND mag.target_scope = 'all'
            )
            OR EXISTS (
                SELECT 1
                FROM member_access_grant AS mag
                WHERE mag.user_account_id = ua.id
                  AND mag.target_scope = 'specific'
                  AND mag.member_id = fm.id
            )
          )
        ORDER BY fm.created_at ASC
        """,
        (user_account_id,),
    ).fetchall()
    return [str(row["member_id"]) for row in rows]


def list_permissions_for_member(connection: sqlite3.Connection, member_id: str) -> list[dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT
            mag.*,
            ua.username AS user_username,
            ua.email AS user_email,
            ua.role AS user_role,
            fm_user.id AS user_member_id,
            fm_user.name AS user_member_name
        FROM member_access_grant AS mag
        JOIN user_account AS ua ON ua.id = mag.user_account_id
        LEFT JOIN family_member AS fm_user ON fm_user.user_account_id = ua.id
        JOIN family_member AS target_member ON target_member.id = ?
        WHERE ua.family_space_id = target_member.family_space_id
          AND (mag.member_id = target_member.id OR mag.target_scope = 'all')
        ORDER BY CASE mag.permission_level
            WHEN 'manage' THEN 3
            WHEN 'write' THEN 2
            WHEN 'read' THEN 1
            ELSE 0
        END DESC,
        CASE mag.target_scope
            WHEN 'all' THEN 0
            ELSE 1
        END ASC,
        mag.created_at ASC
        """,
        (member_id,),
    ).fetchall()
    return [_permission_from_row(row) for row in rows]


def list_permissions_for_user(connection: sqlite3.Connection, user_account_id: str) -> list[dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT
            mag.*,
            ua.username AS user_username,
            ua.email AS user_email,
            ua.role AS user_role,
            fm_user.id AS user_member_id,
            fm_user.name AS user_member_name
        FROM member_access_grant AS mag
        JOIN user_account AS ua ON ua.id = mag.user_account_id
        LEFT JOIN family_member AS fm_user ON fm_user.user_account_id = ua.id
        WHERE mag.user_account_id = ?
        ORDER BY CASE mag.permission_level
            WHEN 'manage' THEN 3
            WHEN 'write' THEN 2
            WHEN 'read' THEN 1
            ELSE 0
        END DESC,
        CASE mag.target_scope
            WHEN 'all' THEN 0
            ELSE 1
        END ASC,
        mag.created_at ASC
        """,
        (user_account_id,),
    ).fetchall()
    return [_permission_from_row(row) for row in rows]


def upsert_member_access_grant(
    connection: sqlite3.Connection,
    *,
    member_id: str | None,
    user_account_id: str,
    permission_level: str,
    target_scope: str,
) -> dict[str, Any]:
    existing = _get_existing_member_access_grant_row(
        connection,
        member_id=member_id,
        user_account_id=user_account_id,
        target_scope=target_scope,
    )
    if existing is None:
        grant_id = str(uuid.uuid4())
        connection.execute(
            """
            INSERT INTO member_access_grant (
                id,
                member_id,
                user_account_id,
                permission_level,
                target_scope,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                grant_id,
                member_id,
                user_account_id,
                permission_level,
                target_scope,
                now_iso(),
            ),
        )
        return get_member_access_grant(connection, grant_id=grant_id)

    connection.execute(
        """
        UPDATE member_access_grant
        SET member_id = ?, permission_level = ?, target_scope = ?
        WHERE id = ?
        """,
        (
            member_id,
            permission_level,
            target_scope,
            existing["id"],
        ),
    )
    return get_member_access_grant(connection, grant_id=str(existing["id"]))


def delete_member_access_grant(connection: sqlite3.Connection, grant_id: str) -> bool:
    result = connection.execute("DELETE FROM member_access_grant WHERE id = ?", (grant_id,))
    return result.rowcount > 0


def create_resource(
    connection: sqlite3.Connection,
    resource: str,
    *,
    member_id: str,
    values: dict[str, Any],
) -> dict[str, Any]:
    config = RESOURCE_CONFIGS[resource]
    timestamp = now_iso()
    record = {
        "id": str(uuid.uuid4()),
        "member_id": member_id,
        **values,
    }
    record["created_at"] = timestamp
    if config.updated_at_field is not None:
        record[config.updated_at_field] = timestamp
    for field_name in config.json_fields:
        if field_name in record:
            record[field_name] = _serialize_json(record[field_name])

    columns = ", ".join(record.keys())
    placeholders = ", ".join(f":{key}" for key in record)
    connection.execute(
        f"INSERT INTO {config.table} ({columns}) VALUES ({placeholders})",
        record,
    )
    return get_resource_by_id(connection, resource, record["id"])


def list_resources_for_member(
    connection: sqlite3.Connection,
    resource: str,
    *,
    member_id: str,
) -> list[dict[str, Any]]:
    config = RESOURCE_CONFIGS[resource]
    rows = connection.execute(
        f"""
        SELECT *
        FROM {config.table}
        WHERE member_id = ?
        ORDER BY CASE WHEN {config.order_field} IS NULL THEN 1 ELSE 0 END,
                 {config.order_field} DESC,
                 created_at DESC
        """,
        (member_id,),
    ).fetchall()
    return [_resource_from_row(row, config) for row in rows]


def get_resource_by_id(
    connection: sqlite3.Connection,
    resource: str,
    resource_id: str,
) -> dict[str, Any] | None:
    config = RESOURCE_CONFIGS[resource]
    row = connection.execute(
        f"SELECT * FROM {config.table} WHERE id = ?",
        (resource_id,),
    ).fetchone()
    return _resource_from_row(row, config) if row else None


def update_resource(
    connection: sqlite3.Connection,
    resource: str,
    resource_id: str,
    changes: dict[str, Any],
) -> dict[str, Any]:
    config = RESOURCE_CONFIGS[resource]
    current = get_resource_by_id(connection, resource, resource_id)
    if current is None:
        raise KeyError(resource_id)

    stored_changes: dict[str, Any] = {}
    for key, value in changes.items():
        if key in config.json_fields:
            stored_changes[key] = _serialize_json(value)
        else:
            stored_changes[key] = value

    if config.updated_at_field is not None:
        stored_changes[config.updated_at_field] = now_iso()
    stored_changes["id"] = resource_id
    assignments = ", ".join(f"{key} = :{key}" for key in stored_changes if key != "id")
    connection.execute(
        f"UPDATE {config.table} SET {assignments} WHERE id = :id",
        stored_changes,
    )
    return get_resource_by_id(connection, resource, resource_id)


def delete_resource(connection: sqlite3.Connection, resource: str, resource_id: str) -> None:
    config = RESOURCE_CONFIGS[resource]
    connection.execute(f"DELETE FROM {config.table} WHERE id = ?", (resource_id,))


def list_observation_trend(
    connection: sqlite3.Connection,
    *,
    member_id: str,
    code: str,
    from_at: str | None,
    to_at: str | None,
) -> list[dict[str, Any]]:
    clauses = ["member_id = ?", "code = ?"]
    parameters: list[Any] = [member_id, code]

    if from_at is not None:
        clauses.append("effective_at >= ?")
        parameters.append(from_at)
    if to_at is not None:
        clauses.append("effective_at <= ?")
        parameters.append(to_at)

    rows = connection.execute(
        f"""
        SELECT *
        FROM observation
        WHERE {' AND '.join(clauses)}
        ORDER BY effective_at ASC, created_at ASC
        """,
        tuple(parameters),
    ).fetchall()
    return [_resource_from_row(row, RESOURCE_CONFIGS["observations"]) for row in rows]
