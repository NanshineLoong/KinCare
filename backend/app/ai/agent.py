from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from pydantic_ai import Agent, DeferredToolRequests, RunContext
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.ai.deps import AIDeps
from app.ai.tools import register_tools
from app.core.config import Settings


AgentOutput = str | DeferredToolRequests
HomeVitalAgent = Agent[AIDeps, AgentOutput]


def create_agent(settings: Settings) -> HomeVitalAgent | None:
    model = _build_model(settings)
    if model is None:
        return None

    agent = Agent(
        model,
        deps_type=AIDeps,
        output_type=[str, DeferredToolRequests],
        instructions=build_system_prompt,
    )
    register_tools(agent)
    return agent


async def build_system_prompt(ctx: RunContext[AIDeps]) -> str:
    parts = [
        "你是 HomeVital 家庭健康助手，帮助用户管理家庭成员的健康档案。",
        f"当前用户：{ctx.deps.current_user.email}",
        f"用户角色：{ctx.deps.current_user.role}",
        f"家庭空间：{ctx.deps.family_space_id}",
        f"今天：{datetime.now(UTC).date().isoformat()}",
        "重要规则：",
        "- 回答健康问题前，优先调用工具查询，不要编造健康数据。",
        "- 写入健康档案必须通过工具完成，不要在文本里假装已经修改。",
        "- 高风险档案写入必须等待用户确认。",
        "- 用中文回答，默认简洁。",
    ]
    if ctx.deps.focus_member_id:
        parts.append(f"当前关注成员 ID：{ctx.deps.focus_member_id}")
    if ctx.deps.page_context:
        parts.append(f"当前页面上下文：{ctx.deps.page_context}")
    return "\n".join(parts)


def _build_model(settings: Settings) -> Any | None:
    if not settings.ai_base_url or not settings.ai_api_key:
        return None
    return OpenAIChatModel(
        settings.ai_model,
        provider=OpenAIProvider(
            base_url=settings.ai_base_url,
            api_key=settings.ai_api_key,
        ),
    )
