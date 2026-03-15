from __future__ import annotations

from typing import Any

from pydantic_ai import RunContext

from app.ai.deps import AIDeps
from app.services import health_repository
from app.services.health_records import ensure_member_access


def register(agent: object) -> None:
    @agent.tool
    async def get_member_summary(ctx: RunContext[AIDeps]) -> dict[str, Any]:
        member_id = ctx.deps.focus_member_id
        if member_id is None:
            return {"content": "请先选择要关注的家庭成员。", "meta": {"member_id": None}}

        member = ensure_member_access(ctx.deps.database, ctx.deps.current_user, member_id, require_write=False)
        with ctx.deps.database.connection() as connection:
            observations = health_repository.list_resources_for_member(connection, "observations", member_id=member_id)
            conditions = health_repository.list_resources_for_member(connection, "conditions", member_id=member_id)
            medications = health_repository.list_resources_for_member(connection, "medications", member_id=member_id)
            care_plans = health_repository.list_resources_for_member(connection, "care-plans", member_id=member_id)

        lines = [f"{member['name']}的健康摘要："]
        if observations:
            latest = observations[0]
            value = latest["value"] if latest["value"] is not None else latest["value_string"]
            lines.append(f"最新指标：{latest['display_name']} {value}{latest['unit'] or ''}")
        if conditions:
            lines.append(f"现病/档案：{conditions[0]['display_name']}")
        if medications:
            lines.append(f"当前用药：{medications[0]['name']}")
        if care_plans:
            lines.append(f"当前提醒：{care_plans[0]['title']}")
        if len(lines) == 1:
            lines.append("当前还没有结构化健康记录。")

        return {
            "content": "；".join(lines),
            "meta": {
                "member_id": member_id,
                "member_name": member["name"],
            },
        }

    @agent.tool
    async def get_recent_observations(
        ctx: RunContext[AIDeps],
        category: str | None = None,
        code: str | None = None,
        limit: int = 10,
    ) -> dict[str, Any]:
        member_id = ctx.deps.focus_member_id
        if member_id is None:
            return {"content": "请先选择要关注的家庭成员。", "meta": {"items": []}}

        ensure_member_access(ctx.deps.database, ctx.deps.current_user, member_id, require_write=False)
        with ctx.deps.database.connection() as connection:
            items = health_repository.list_resources_for_member(connection, "observations", member_id=member_id)

        filtered = [
            item
            for item in items
            if (category is None or item["category"] == category) and (code is None or item["code"] == code)
        ][: max(limit, 1)]
        if not filtered:
            return {"content": "暂无相关观测记录。", "meta": {"items": []}}

        lines = []
        for item in filtered:
            value = item["value"] if item["value"] is not None else item["value_string"]
            lines.append(f"{item['display_name']} {value}{item['unit'] or ''} ({item['effective_at']})")
        return {"content": "\n".join(lines), "meta": {"items": filtered}}

    @agent.tool
    async def get_conditions(ctx: RunContext[AIDeps]) -> dict[str, Any]:
        return await _list_resource(ctx, "conditions", "当前没有健康状况记录。")

    @agent.tool
    async def get_medications(ctx: RunContext[AIDeps]) -> dict[str, Any]:
        return await _list_resource(ctx, "medications", "当前没有用药记录。")

    @agent.tool
    async def get_care_plans(ctx: RunContext[AIDeps]) -> dict[str, Any]:
        return await _list_resource(ctx, "care-plans", "当前没有提醒或健康计划。")

    @agent.tool
    async def get_sleep_records(ctx: RunContext[AIDeps]) -> dict[str, Any]:
        return await _list_resource(ctx, "sleep-records", "当前没有睡眠记录。")

    @agent.tool
    async def get_workout_records(ctx: RunContext[AIDeps]) -> dict[str, Any]:
        return await _list_resource(ctx, "workout-records", "当前没有运动记录。")

    @agent.tool
    async def get_encounters(ctx: RunContext[AIDeps]) -> dict[str, Any]:
        return await _list_resource(ctx, "encounters", "当前没有就诊记录。")


async def _list_resource(ctx: RunContext[AIDeps], resource: str, empty_text: str) -> dict[str, Any]:
    member_id = ctx.deps.focus_member_id
    if member_id is None:
        return {"content": "请先选择要关注的家庭成员。", "meta": {"items": []}}

    ensure_member_access(ctx.deps.database, ctx.deps.current_user, member_id, require_write=False)
    with ctx.deps.database.connection() as connection:
        items = health_repository.list_resources_for_member(connection, resource, member_id=member_id)

    if not items:
        return {"content": empty_text, "meta": {"items": []}}
    return {"content": f"共 {len(items)} 条记录。", "meta": {"items": items}}
