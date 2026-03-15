from __future__ import annotations

from collections.abc import AsyncIterator
import re
from datetime import UTC, datetime
from typing import Any

from pydantic_ai import Agent, DeferredToolRequests, RunContext
from pydantic_ai.messages import ModelMessage, ModelResponse, TextPart, ToolCallPart
from pydantic_ai.models.function import AgentInfo, DeltaToolCall, FunctionModel
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.ai.deps import AIDeps
from app.ai.tools import register_tools
from app.core.config import Settings
from app.schemas.chat import DocumentExtractionDraft


AgentOutput = str | DeferredToolRequests
HomeVitalAgent = Agent[AIDeps, AgentOutput]

OBSERVATION_PATTERNS = [
    (
        re.compile(r"心率\s*([0-9]{2,3})"),
        {
            "category": "body-vitals",
            "code": "heart-rate",
            "display_name": "心率",
            "unit": "bpm",
        },
    ),
    (
        re.compile(r"血压\s*([0-9]{2,3})"),
        {
            "category": "chronic-vitals",
            "code": "bp-systolic",
            "display_name": "收缩压",
            "unit": "mmHg",
        },
    ),
]


def create_agent(settings: Settings) -> HomeVitalAgent:
    agent = Agent(
        _build_model(settings),
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


def _build_model(settings: Settings) -> Any:
    if settings.ai_provider == "stub":
        return FunctionModel(function=_stub_model, stream_function=_stream_stub_model)
    if not settings.ai_base_url or not settings.ai_api_key:
        return FunctionModel(function=_unconfigured_model, stream_function=_stream_unconfigured_model)
    return OpenAIChatModel(
        settings.ai_model,
        provider=OpenAIProvider(
            base_url=settings.ai_base_url,
            api_key=settings.ai_api_key,
        ),
    )


async def _unconfigured_model(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
    del messages, info
    return ModelResponse(
        parts=[
            TextPart(
                "AI 模型尚未配置。请提供 HOMEVITAL_AI_BASE_URL 和 HOMEVITAL_AI_API_KEY，或在测试中使用 stub provider。"
            )
        ]
    )


async def _stream_unconfigured_model(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str | dict[int, DeltaToolCall]]:
    response = await _unconfigured_model(messages, info)
    async for chunk in _stream_model_response(response):
        yield chunk


async def _stub_model(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
    latest_part = _latest_part(messages)
    if latest_part is not None and getattr(latest_part, "part_kind", None) == "tool-return":
        return ModelResponse(parts=[TextPart(_tool_return_to_text(latest_part.tool_name, latest_part.content))])

    prompt = _latest_user_prompt(messages)
    if not prompt:
        return ModelResponse(parts=[TextPart("请告诉我想查询或处理的内容。")])

    tool_names = {tool.name for tool in info.function_tools}

    if any(keyword in prompt for keyword in ("提取", "录入", "保存")):
        observation = _extract_observation(prompt)
        if observation is not None and "draft_observations" in tool_names:
            return ModelResponse(parts=[ToolCallPart("draft_observations", {"observations": [observation]})])

    if "分析" in prompt:
        observation = _extract_observation(prompt)
        if observation is not None and "suggest_record_update" in tool_names:
            draft = DocumentExtractionDraft(observations=[observation]).model_dump()
            return ModelResponse(
                parts=[
                    ToolCallPart(
                        "suggest_record_update",
                        {
                            "suggestion_summary": f"识别到一条可入库的{observation['display_name']}记录。",
                            "draft": draft,
                        },
                    )
                ]
            )

    if (
        any(keyword in prompt for keyword in ("跑步", "跑个步", "散步", "运动", "锻炼"))
        or re.search(r"跑.*步", prompt)
    ) and "create_care_plan" in tool_names:
        return ModelResponse(
            parts=[
                ToolCallPart(
                    "create_care_plan",
                    {
                        "title": "下午跑步",
                        "description": prompt.strip(),
                        "category": "activity-reminder",
                        "scheduled_at": _scheduled_at_from_prompt(prompt),
                    },
                )
            ]
        )

    if "提醒" in prompt and "create_scheduled_task" in tool_names:
        schedule = _schedule_payload_from_prompt(prompt)
        if schedule is not None:
            return ModelResponse(parts=[ToolCallPart("create_scheduled_task", schedule)])

    if "get_member_summary" in tool_names:
        return ModelResponse(parts=[ToolCallPart("get_member_summary", {})])

    return ModelResponse(parts=[TextPart("请先选择要关注的成员。")])


async def _stream_stub_model(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str | dict[int, DeltaToolCall]]:
    response = await _stub_model(messages, info)
    async for chunk in _stream_model_response(response):
        yield chunk


async def _stream_model_response(response: ModelResponse) -> AsyncIterator[str | dict[int, DeltaToolCall]]:
    for index, part in enumerate(response.parts):
        if isinstance(part, TextPart):
            if part.content:
                yield part.content
            continue
        if isinstance(part, ToolCallPart):
            yield {
                index: DeltaToolCall(
                    name=part.tool_name,
                    json_args=part.args_as_json_str(),
                    tool_call_id=part.tool_call_id,
                )
            }


def _latest_part(messages: list[ModelMessage]) -> Any | None:
    if not messages:
        return None
    last_message = messages[-1]
    if not getattr(last_message, "parts", None):
        return None
    return last_message.parts[-1]


def _latest_user_prompt(messages: list[ModelMessage]) -> str:
    for message in reversed(messages):
        for part in reversed(getattr(message, "parts", ())):
            if getattr(part, "part_kind", None) == "user-prompt":
                return str(part.content).strip()
    return ""


def _extract_observation(prompt: str) -> dict[str, Any] | None:
    for pattern, details in OBSERVATION_PATTERNS:
        match = pattern.search(prompt)
        if match is None:
            continue
        return {
            **details,
            "value": float(match.group(1)),
            "effective_at": datetime.now(UTC).isoformat(),
        }
    return None


def _tool_return_to_text(tool_name: str, content: Any) -> str:
    if isinstance(content, dict):
        if "content" in content:
            return str(content["content"])
        if tool_name.startswith("draft_"):
            resource_type = str(content.get("resource_type", "records"))
            count = int(content.get("count", 0))
            return f"已写入 {count} 条 {resource_type} 记录。"
        if "suggestion_summary" in content:
            return f"{content['suggestion_summary']} 如需保存，请确认。"
        return json_safe_dump(content)
    return str(content)


def _scheduled_at_from_prompt(prompt: str) -> str | None:
    match = re.search(r"(上午|下午)?\s*(\d{1,2})[:：]?(\d{2})?", prompt)
    if match is None:
        return None
    hour = int(match.group(2))
    minute = int(match.group(3) or "00")
    if match.group(1) == "下午" and hour < 12:
        hour += 12
    scheduled_at = datetime.now(UTC).replace(hour=hour, minute=minute, second=0, microsecond=0)
    return scheduled_at.isoformat()


def _schedule_payload_from_prompt(prompt: str) -> dict[str, Any] | None:
    daily_match = re.search(r"每天\s*(\d{1,2})[:：](\d{2})", prompt)
    if daily_match:
        return {
            "task_type": "daily-check",
            "prompt": prompt.strip(),
            "schedule_type": "daily",
            "schedule_config": {
                "hour": int(daily_match.group(1)),
                "minute": int(daily_match.group(2)),
            },
        }
    return None


def json_safe_dump(value: Any) -> str:
    import json

    return json.dumps(value, ensure_ascii=False)
