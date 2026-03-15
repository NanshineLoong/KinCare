from __future__ import annotations

from typing import Any

from pydantic_ai import RunContext

from app.ai.deps import AIDeps
from app.ai.extraction import apply_draft_to_member
from app.schemas.chat import (
    HealthRecordConditionDraft,
    HealthRecordDraft,
    HealthRecordEncounterDraft,
    HealthRecordMedicationDraft,
    HealthRecordObservationDraft,
)


def register(agent: object) -> None:
    @agent.tool(requires_approval=True)
    async def draft_observations(
        ctx: RunContext[AIDeps],
        observations: list[HealthRecordObservationDraft],
    ) -> dict[str, Any]:
        return _write_records(
            ctx,
            resource="observations",
            items=[item.model_dump() for item in observations],
            source="ai-extract",
        )

    @agent.tool(requires_approval=True)
    async def draft_conditions(
        ctx: RunContext[AIDeps],
        conditions: list[HealthRecordConditionDraft],
    ) -> dict[str, Any]:
        return _write_records(
            ctx,
            resource="conditions",
            items=[item.model_dump() for item in conditions],
            source="ai-extract",
        )

    @agent.tool(requires_approval=True)
    async def draft_medications(
        ctx: RunContext[AIDeps],
        medications: list[HealthRecordMedicationDraft],
    ) -> dict[str, Any]:
        return _write_records(
            ctx,
            resource="medications",
            items=[item.model_dump() for item in medications],
            source="ai-extract",
        )

    @agent.tool(requires_approval=True)
    async def draft_encounter(
        ctx: RunContext[AIDeps],
        encounters: list[HealthRecordEncounterDraft],
    ) -> dict[str, Any]:
        return _write_records(
            ctx,
            resource="encounters",
            items=[item.model_dump() for item in encounters],
            source="ai-extract",
        )


def _write_records(
    ctx: RunContext[AIDeps],
    *,
    resource: str,
    items: list[dict[str, Any]],
    source: str,
) -> dict[str, Any]:
    member_id = ctx.deps.focus_member_id
    if member_id is None:
        return {"resource_type": resource, "count": 0, "content": "请先选择家庭成员。"}

    counts = apply_draft_to_member(
        database=ctx.deps.database,
        current_user=ctx.deps.current_user,
        member_id=member_id,
        draft=_draft_payload(resource, items),
        source=source,
    )

    return {
        "resource_type": resource,
        "count": counts[resource],
        "content": f"已写入 {counts[resource]} 条{resource}记录。",
    }


def _draft_payload(resource: str, items: list[dict[str, Any]]) -> dict[str, Any]:
    payload = HealthRecordDraft().model_dump()
    payload[resource] = items
    return payload
