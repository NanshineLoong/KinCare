from __future__ import annotations

from typing import Any

from app.core.database import Database
from app.core.dependencies import CurrentUser
from app.schemas.health import HealthRecordDraft
from app.services.health_records import create_resource, delete_resource, update_resource


def normalize_health_record_draft(payload: dict[str, Any] | None) -> dict[str, Any]:
    model = HealthRecordDraft.model_validate(payload or {})
    return model.model_dump()


def apply_draft_to_member(
    *,
    database: Database,
    current_user: CurrentUser,
    draft: dict[str, Any],
    source: str,
) -> dict[str, int]:
    normalized = normalize_health_record_draft(draft)
    counts = {
        "observations": 0,
        "conditions": 0,
        "medications": 0,
        "encounters": 0,
    }

    for action in normalized["actions"]:
        resource = str(action["resource"])
        member_id = str(action["target_member_id"])
        if action["action"] == "create":
            payload = {
                **(action["payload"] or {}),
                "source": source,
            }
            create_resource(resource, member_id, payload, database, current_user)
        elif action["action"] == "update":
            update_resource(
                resource,
                member_id,
                str(action["record_id"]),
                dict(action["payload"] or {}),
                database,
                current_user,
            )
        else:
            delete_resource(
                resource,
                member_id,
                str(action["record_id"]),
                database,
                current_user,
            )
        counts[resource] += 1

    return counts
