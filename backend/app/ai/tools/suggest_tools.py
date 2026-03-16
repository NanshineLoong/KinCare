from __future__ import annotations

from typing import Any

from app.schemas.health import HealthRecordDraft


def register(agent: object) -> None:
    @agent.tool_plain
    def suggest_record_update(
        suggestion_summary: str,
        draft: HealthRecordDraft,
    ) -> dict[str, Any]:
        return {
            "content": "我已经完成分析，并整理出可保存到档案的建议。",
            "suggestion_summary": suggestion_summary,
            "draft": draft.model_dump(),
        }
