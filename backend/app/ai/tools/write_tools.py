from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from pydantic_ai import RunContext

from app.ai import scheduler as scheduler_service
from app.ai.deps import AIDeps
from app.services import health_repository
from app.services.health_records import ensure_member_access


def register(agent: object) -> None:
    @agent.tool
    async def create_care_plan(
        ctx: RunContext[AIDeps],
        title: str,
        description: str = "",
        category: str = "activity-reminder",
        scheduled_at: str | None = None,
    ) -> dict[str, Any]:
        member_id = ctx.deps.focus_member_id
        if member_id is None:
            return {"content": "当前咨询人还不明确，请先确认是哪位家庭成员后再创建提醒。", "meta": {"created": False}}

        ensure_member_access(
            ctx.deps.database,
            ctx.deps.current_user,
            member_id,
            required_permission="write",
        )
        with ctx.deps.database.connection() as connection:
            record = health_repository.create_resource(
                connection,
                "care-plans",
                member_id=member_id,
                values={
                    "category": category,
                    "title": title,
                    "description": description or title,
                    "status": "active",
                    "scheduled_at": scheduled_at,
                    "generated_by": "ai",
                },
            )

        return {
            "content": f"已创建提醒：{record['title']}",
            "meta": {
                "resource_type": "care-plan",
                "resource_id": record["id"],
                "member_id": member_id,
            },
        }

    @agent.tool
    async def create_scheduled_task(
        ctx: RunContext[AIDeps],
        task_type: str,
        prompt: str,
        schedule_type: str,
        schedule_config: dict[str, Any],
    ) -> dict[str, Any]:
        member_id = ctx.deps.focus_member_id
        task = scheduler_service.create_scheduled_task(
            database=ctx.deps.database,
            current_user=ctx.deps.current_user,
            member_id=member_id,
            payload={
                "task_type": task_type,
                "prompt": prompt,
                "schedule_type": schedule_type,
                "schedule_config": schedule_config,
            },
            scheduler=ctx.deps.scheduler,
        )
        return {
            "content": f"已创建定时任务，下次执行时间：{task['next_run_at'] or '待计算'}",
            "meta": {
                "task_id": task["id"],
                "member_id": member_id,
            },
        }

    @agent.tool
    async def mark_care_plan_done(ctx: RunContext[AIDeps], care_plan_id: str) -> dict[str, Any]:
        member_id = ctx.deps.focus_member_id
        if member_id is None:
            return {"content": "当前咨询人还不明确，请先确认是哪位家庭成员。", "meta": {"updated": False}}

        ensure_member_access(
            ctx.deps.database,
            ctx.deps.current_user,
            member_id,
            required_permission="write",
        )
        with ctx.deps.database.connection() as connection:
            record = health_repository.get_resource_by_id(connection, "care-plans", care_plan_id)
            if record is None or record["member_id"] != member_id:
                return {"content": "未找到要更新的提醒。", "meta": {"updated": False}}
            updated = health_repository.update_resource(
                connection,
                "care-plans",
                care_plan_id,
                {
                    "status": "completed",
                    "completed_at": datetime.now(UTC).isoformat(),
                },
            )

        return {
            "content": f"已完成提醒：{updated['title']}",
            "meta": {
                "resource_type": "care-plan",
                "resource_id": updated["id"],
                "member_id": member_id,
            },
        }
