from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status

from app.core.database import Database
from app.core.dependencies import CurrentUser
from app.services import health_repository, repository


READABLE_RESOURCE_NAMES = {
    "observations": "Observation",
    "conditions": "Condition",
    "medications": "Medication",
    "encounters": "Encounter",
    "sleep-records": "Sleep record",
    "workout-records": "Workout record",
    "health-summaries": "Health summary",
    "care-plans": "Care plan",
}


def _parse_datetime(value: str | None) -> datetime | None:
    if value is None:
        return None
    return datetime.fromisoformat(value)


def ensure_member_access(
    database: Database,
    current_user: CurrentUser,
    member_id: str,
    *,
    require_write: bool,
) -> dict[str, Any]:
    with database.connection() as connection:
        member = repository.get_member_by_id(connection, member_id)
        if member is None or member["family_space_id"] != current_user.family_space_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found.")

        if current_user.role == "admin":
            return member
        if current_user.member_id == member_id:
            return member
        if health_repository.has_member_access_grant(
            connection,
            member_id=member_id,
            user_account_id=current_user.id,
            require_write=require_write,
        ):
            return member

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions.")


def list_resource(
    resource: str,
    member_id: str,
    database: Database,
    current_user: CurrentUser,
) -> list[dict[str, Any]]:
    ensure_member_access(database, current_user, member_id, require_write=False)
    with database.connection() as connection:
        return health_repository.list_resources_for_member(connection, resource, member_id=member_id)


def create_resource(
    resource: str,
    member_id: str,
    payload: dict[str, Any],
    database: Database,
    current_user: CurrentUser,
) -> dict[str, Any]:
    ensure_member_access(database, current_user, member_id, require_write=True)
    with database.connection() as connection:
        return health_repository.create_resource(connection, resource, member_id=member_id, values=dict(payload))


def get_resource(
    resource: str,
    member_id: str,
    resource_id: str,
    database: Database,
    current_user: CurrentUser,
) -> dict[str, Any]:
    ensure_member_access(database, current_user, member_id, require_write=False)
    with database.connection() as connection:
        item = health_repository.get_resource_by_id(connection, resource, resource_id)

    if item is None or item["member_id"] != member_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{READABLE_RESOURCE_NAMES[resource]} not found.",
        )
    return item


def update_resource(
    resource: str,
    member_id: str,
    resource_id: str,
    changes: dict[str, Any],
    database: Database,
    current_user: CurrentUser,
) -> dict[str, Any]:
    ensure_member_access(database, current_user, member_id, require_write=True)
    with database.connection() as connection:
        existing = health_repository.get_resource_by_id(connection, resource, resource_id)
        if existing is None or existing["member_id"] != member_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{READABLE_RESOURCE_NAMES[resource]} not found.",
            )
        if not changes:
            return existing
        return health_repository.update_resource(connection, resource, resource_id, changes)


def delete_resource(
    resource: str,
    member_id: str,
    resource_id: str,
    database: Database,
    current_user: CurrentUser,
) -> None:
    ensure_member_access(database, current_user, member_id, require_write=True)
    with database.connection() as connection:
        existing = health_repository.get_resource_by_id(connection, resource, resource_id)
        if existing is None or existing["member_id"] != member_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{READABLE_RESOURCE_NAMES[resource]} not found.",
            )
        health_repository.delete_resource(connection, resource, resource_id)


def get_observation_trend(
    member_id: str,
    *,
    code: str,
    from_at: str | None,
    to_at: str | None,
    database: Database,
    current_user: CurrentUser,
) -> dict[str, Any]:
    ensure_member_access(database, current_user, member_id, require_write=False)
    with database.connection() as connection:
        items = health_repository.list_observation_trend(
            connection,
            member_id=member_id,
            code=code,
            from_at=from_at,
            to_at=to_at,
        )

    display_name = items[0]["display_name"] if items else None
    points = [
        {
            "id": item["id"],
            "effective_at": item["effective_at"],
            "value": item["value"],
            "value_string": item["value_string"],
            "unit": item["unit"],
            "notes": item["notes"],
        }
        for item in items
    ]
    return {
        "member_id": member_id,
        "code": code,
        "display_name": display_name,
        "points": points,
    }


def _visible_members(database: Database, current_user: CurrentUser) -> list[dict[str, Any]]:
    with database.connection() as connection:
        if current_user.role == "admin":
            return repository.list_members_by_family_space(connection, current_user.family_space_id)

        visible_ids: list[str] = []
        if current_user.member_id is not None:
            visible_ids.append(current_user.member_id)
        for member_id in health_repository.list_granted_member_ids(connection, current_user.id):
            if member_id not in visible_ids:
                visible_ids.append(member_id)

        members: list[dict[str, Any]] = []
        for member_id in visible_ids:
            member = repository.get_member_by_id(connection, member_id)
            if member is None or member["family_space_id"] != current_user.family_space_id:
                continue
            members.append(member)
        return members


def get_dashboard(database: Database, current_user: CurrentUser) -> dict[str, Any]:
    members = _visible_members(database, current_user)
    today = datetime.now(UTC).date()
    summaries: list[dict[str, Any]] = []
    reminders: list[dict[str, Any]] = []

    with database.connection() as connection:
        for member in members:
            health_summaries = health_repository.list_resources_for_member(
                connection,
                "health-summaries",
                member_id=member["id"],
            )

            care_plans = health_repository.list_resources_for_member(
                connection,
                "care-plans",
                member_id=member["id"],
            )
            for care_plan in care_plans:
                scheduled_at = _parse_datetime(care_plan["scheduled_at"])
                if (
                    care_plan["status"] == "active"
                    and scheduled_at is not None
                    and scheduled_at.date() == today
                ):
                    reminders.append(
                        {
                            **care_plan,
                            "member_name": member["name"],
                        }
                    )

            summaries.append(
                {
                    "member": {
                        "id": member["id"],
                        "name": member["name"],
                        "gender": member["gender"],
                        "avatar_url": member["avatar_url"],
                        "blood_type": member["blood_type"],
                    },
                    "health_summaries": health_summaries[:4],
                }
            )

    reminders.sort(key=lambda item: (_parse_datetime(item["scheduled_at"]) or datetime.max.replace(tzinfo=UTC)))
    return {
        "members": summaries,
        "today_reminders": reminders,
    }
