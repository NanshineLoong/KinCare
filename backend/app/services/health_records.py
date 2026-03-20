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
PERMISSION_LEVEL_RANK = {
    "none": 0,
    "read": 1,
    "write": 2,
    "manage": 3,
}
CARE_PLAN_TIME_SLOTS = ("清晨", "上午", "午后", "晚间", "睡前")
CARE_PLAN_ICON_BY_CATEGORY = {
    "medication-reminder": "medication",
    "activity-reminder": "exercise",
    "checkup-reminder": "checkup",
    "health-advice": "general",
    "daily-tip": "general",
}


def _parse_datetime(value: str | None) -> datetime | None:
    if value is None:
        return None
    return datetime.fromisoformat(value)


def _higher_permission(first: str, second: str | None) -> str:
    if second is None:
        return first
    return first if PERMISSION_LEVEL_RANK[first] >= PERMISSION_LEVEL_RANK[second] else second


def _infer_time_slot(scheduled_at: str | None) -> str | None:
    parsed = _parse_datetime(scheduled_at)
    if parsed is None:
        return None
    hour = parsed.hour
    if hour < 9:
        return "清晨"
    if hour < 12:
        return "上午"
    if hour < 18:
        return "午后"
    if hour < 22:
        return "晚间"
    return "睡前"


def _normalize_care_plan(care_plan: dict[str, Any], *, member_id: str) -> dict[str, Any]:
    normalized = dict(care_plan)
    normalized["assignee_member_id"] = normalized.get("assignee_member_id") or member_id
    normalized["icon_key"] = normalized.get("icon_key") or CARE_PLAN_ICON_BY_CATEGORY.get(
        normalized["category"],
        "general",
    )
    normalized["time_slot"] = normalized.get("time_slot") or _infer_time_slot(normalized.get("scheduled_at"))
    return normalized


def _dashboard_reminder(care_plan: dict[str, Any], *, member_name: str) -> dict[str, Any]:
    reminder = _normalize_care_plan(care_plan, member_id=care_plan["member_id"])
    reminder["member_name"] = member_name
    return reminder


def _build_reminder_groups(reminders: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for reminder in reminders:
        time_slot = reminder.get("time_slot")
        if time_slot is None:
            continue
        grouped.setdefault(str(time_slot), []).append(reminder)

    groups: list[dict[str, Any]] = []
    for time_slot in CARE_PLAN_TIME_SLOTS:
        items = grouped.get(time_slot)
        if items:
            groups.append({"time_slot": time_slot, "reminders": items})
    return groups


def resolve_member_permission_level(
    connection: Any,
    current_user: CurrentUser,
    member_id: str,
) -> str:
    permission_level = "none"
    if current_user.role == "admin":
        permission_level = "manage"
    elif current_user.member_id == member_id:
        permission_level = "write"

    granted_permission = health_repository.resolve_member_access_level(
        connection,
        member_id=member_id,
        user_account_id=current_user.id,
    )
    return _higher_permission(permission_level, granted_permission)


def get_member_permission_level(
    database: Database,
    current_user: CurrentUser,
    member_id: str,
) -> str:
    with database.connection() as connection:
        member = repository.get_member_by_id(connection, member_id)
        if member is None or member["family_space_id"] != current_user.family_space_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found.")
        return resolve_member_permission_level(connection, current_user, member_id)


def _ensure_can_manage_all_permissions(connection: Any, current_user: CurrentUser) -> None:
    if current_user.role == "admin":
        return
    if health_repository.has_all_scope_access_grant(
        connection,
        user_account_id=current_user.id,
        required_permission="manage",
    ):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions.")


def ensure_member_access(
    database: Database,
    current_user: CurrentUser,
    member_id: str,
    *,
    required_permission: str = "read",
) -> dict[str, Any]:
    with database.connection() as connection:
        member = repository.get_member_by_id(connection, member_id)
        if member is None or member["family_space_id"] != current_user.family_space_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found.")
        permission_level = resolve_member_permission_level(connection, current_user, member_id)
        if PERMISSION_LEVEL_RANK[permission_level] >= PERMISSION_LEVEL_RANK[required_permission]:
            return {
                **member,
                "permission_level": permission_level,
            }

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions.")


def list_member_permissions(
    member_id: str,
    database: Database,
    current_user: CurrentUser,
) -> list[dict[str, Any]]:
    ensure_member_access(database, current_user, member_id, required_permission="manage")
    with database.connection() as connection:
        return health_repository.list_permissions_for_member(connection, member_id)


def grant_member_permission(
    member_id: str,
    *,
    user_account_id: str,
    permission_level: str,
    target_scope: str,
    database: Database,
    current_user: CurrentUser,
) -> dict[str, Any]:
    ensure_member_access(database, current_user, member_id, required_permission="manage")
    with database.connection() as connection:
        member = repository.get_member_by_id(connection, member_id)
        if member is None or member["family_space_id"] != current_user.family_space_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found.")

        user = repository.get_user_by_id(connection, user_account_id)
        if user is None or user["family_space_id"] != current_user.family_space_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

        if target_scope == "all":
            _ensure_can_manage_all_permissions(connection, current_user)
            stored_member_id: str | None = None
        else:
            stored_member_id = member_id

        return health_repository.upsert_member_access_grant(
            connection,
            member_id=stored_member_id,
            user_account_id=user_account_id,
            permission_level=permission_level,
            target_scope=target_scope,
        )


def revoke_member_permission(
    member_id: str,
    grant_id: str,
    database: Database,
    current_user: CurrentUser,
) -> None:
    ensure_member_access(database, current_user, member_id, required_permission="manage")
    with database.connection() as connection:
        member = repository.get_member_by_id(connection, member_id)
        if member is None or member["family_space_id"] != current_user.family_space_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found.")

        grant = health_repository.get_member_access_grant(connection, grant_id=grant_id)
        if grant is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permission grant not found.")
        if grant["target_scope"] == "all":
            _ensure_can_manage_all_permissions(connection, current_user)
        elif grant["member_id"] != member_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permission grant not found.")

        deleted = health_repository.delete_member_access_grant(connection, grant_id)
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permission grant not found.")


def list_resource(
    resource: str,
    member_id: str,
    database: Database,
    current_user: CurrentUser,
) -> list[dict[str, Any]]:
    ensure_member_access(database, current_user, member_id, required_permission="read")
    with database.connection() as connection:
        return health_repository.list_resources_for_member(connection, resource, member_id=member_id)


def create_resource(
    resource: str,
    member_id: str,
    payload: dict[str, Any],
    database: Database,
    current_user: CurrentUser,
) -> dict[str, Any]:
    ensure_member_access(database, current_user, member_id, required_permission="write")
    with database.connection() as connection:
        return health_repository.create_resource(connection, resource, member_id=member_id, values=dict(payload))


def get_resource(
    resource: str,
    member_id: str,
    resource_id: str,
    database: Database,
    current_user: CurrentUser,
) -> dict[str, Any]:
    ensure_member_access(database, current_user, member_id, required_permission="read")
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
    ensure_member_access(database, current_user, member_id, required_permission="write")
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
    ensure_member_access(database, current_user, member_id, required_permission="write")
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
    ensure_member_access(database, current_user, member_id, required_permission="read")
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
                    reminders.append(_dashboard_reminder(care_plan, member_name=member["name"]))

            summaries.append(
                {
                    "member": {
                        "id": member["id"],
                        "name": member["name"],
                        "gender": member["gender"],
                        "avatar_url": member["avatar_url"],
                        "blood_type": member["blood_type"],
                    },
                    "health_summaries": health_summaries,
                }
            )

    reminders.sort(key=lambda item: (_parse_datetime(item["scheduled_at"]) or datetime.max.replace(tzinfo=UTC)))
    return {
        "members": summaries,
        "today_reminders": reminders,
        "reminder_groups": _build_reminder_groups(reminders),
    }


def list_visible_members_with_permission(
    database: Database,
    current_user: CurrentUser,
    *,
    required_permission: str,
) -> list[dict[str, Any]]:
    members = _visible_members(database, current_user)
    visible_members: list[dict[str, Any]] = []

    with database.connection() as connection:
        for member in members:
            permission_level = resolve_member_permission_level(connection, current_user, member["id"])
            if PERMISSION_LEVEL_RANK[permission_level] >= PERMISSION_LEVEL_RANK[required_permission]:
                visible_members.append(
                    {
                        **member,
                        "permission_level": permission_level,
                    }
                )

    return visible_members


def list_all_members_for_scheduler(connection: Any) -> list[dict[str, Any]]:
    family_space_rows = connection.execute(
        "SELECT id FROM family_space ORDER BY created_at ASC"
    ).fetchall()
    members: list[dict[str, Any]] = []
    for row in family_space_rows:
        members.extend(repository.list_members_by_family_space(connection, str(row["id"])))
    return members


def build_member_daily_generation_snapshot(
    connection: Any,
    *,
    member_id: str,
    now: datetime,
    timezone: str,
) -> dict[str, Any]:
    member = repository.get_member_by_id(connection, member_id)
    if member is None:
        raise KeyError(member_id)

    care_plans = health_repository.list_resources_for_member(connection, "care-plans", member_id=member_id)
    today_manual_care_plans = [
        item
        for item in care_plans
        if item["generated_by"] == "manual"
        and item["status"] == "active"
        and _resource_is_scheduled_for_day(item.get("scheduled_at"), now)
    ]
    return {
        "member": {
            "id": member["id"],
            "name": member["name"],
            "gender": member["gender"],
            "birth_date": member["birth_date"],
            "height_cm": member["height_cm"],
            "blood_type": member["blood_type"],
        },
        "observations": health_repository.list_resources_for_member(connection, "observations", member_id=member_id)[:12],
        "conditions": health_repository.list_resources_for_member(connection, "conditions", member_id=member_id)[:10],
        "medications": health_repository.list_resources_for_member(connection, "medications", member_id=member_id)[:10],
        "encounters": health_repository.list_resources_for_member(connection, "encounters", member_id=member_id)[:8],
        "sleep_records": health_repository.list_resources_for_member(connection, "sleep-records", member_id=member_id)[:7],
        "workout_records": health_repository.list_resources_for_member(connection, "workout-records", member_id=member_id)[:7],
        "today_manual_care_plans": today_manual_care_plans,
        "timezone": timezone,
        "generated_for_date": now.date().isoformat(),
    }


def replace_generated_health_summaries(
    connection: Any,
    *,
    member_id: str,
    generated_at: str,
    summaries: list[dict[str, Any]],
) -> None:
    existing = health_repository.list_resources_for_member(connection, "health-summaries", member_id=member_id)
    for item in existing:
        health_repository.delete_resource(connection, "health-summaries", item["id"])

    for summary in reversed(summaries):
        health_repository.create_resource(
            connection,
            "health-summaries",
            member_id=member_id,
            values={
                "category": summary["category"],
                "label": summary["label"],
                "value": summary["value"],
                "status": summary["status"],
                "generated_at": generated_at,
            },
        )


def replace_generated_daily_care_plans(
    connection: Any,
    *,
    member_id: str,
    now: datetime,
    care_plans: list[dict[str, Any]],
) -> bool:
    existing = health_repository.list_resources_for_member(connection, "care-plans", member_id=member_id)
    for item in existing:
        if (
            item["generated_by"] == "ai"
            and item["status"] == "active"
            and _resource_is_scheduled_for_day(item.get("scheduled_at"), now)
        ):
            health_repository.delete_resource(connection, "care-plans", item["id"])

    for care_plan in care_plans:
        normalized = _normalize_care_plan(care_plan, member_id=member_id)
        health_repository.create_resource(
            connection,
            "care-plans",
            member_id=member_id,
            values={
                "assignee_member_id": normalized["assignee_member_id"],
                "category": normalized["category"],
                "icon_key": normalized["icon_key"],
                "time_slot": normalized["time_slot"],
                "title": normalized["title"],
                "description": normalized["description"],
                "notes": normalized.get("notes"),
                "status": "active",
                "scheduled_at": normalized["scheduled_at"],
                "generated_by": "ai",
            },
        )
    return True


def _resource_is_scheduled_for_day(scheduled_at: str | None, now: datetime) -> bool:
    parsed = _parse_datetime(scheduled_at)
    if parsed is None:
        return False
    return parsed.astimezone(now.tzinfo).date() == now.date()
