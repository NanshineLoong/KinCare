from __future__ import annotations

from typing import Any

from pydantic_ai import RunContext

from app.ai.deps import AIDeps
from app.ai.extraction import apply_draft_to_member
from app.schemas.health import HealthRecordAction, HealthRecordDraft


def register(agent: object) -> None:
    @agent.tool(requires_approval=True)
    async def draft_health_record_actions(
        ctx: RunContext[AIDeps],
        actions: list[HealthRecordAction],
        summary: str = "",
    ) -> dict[str, Any]:
        return _apply_actions(
            ctx,
            draft=HealthRecordDraft(summary=summary, actions=actions),
            source="ai-extract",
        )


def _apply_actions(
    ctx: RunContext[AIDeps],
    *,
    draft: HealthRecordDraft,
    source: str,
) -> dict[str, Any]:
    if not draft.actions:
        return {
            "content": "没有可执行的健康档案操作。",
            "resource_counts": {
                "observations": 0,
                "conditions": 0,
                "medications": 0,
                "encounters": 0,
            },
        }

    counts = apply_draft_to_member(
        database=ctx.deps.database,
        current_user=ctx.deps.current_user,
        draft=draft.model_dump(),
        source=source,
    )

    return {
        "resource_counts": counts,
        "content": f"已处理 {sum(counts.values())} 条健康档案操作。",
    }
