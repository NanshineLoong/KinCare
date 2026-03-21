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
KinCareAgent = Agent[AIDeps, AgentOutput]


def create_agent(settings: Settings) -> KinCareAgent | None:
    model = build_model(settings)
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
        "你是 KinCare 家庭健康助手，帮助用户管理家庭成员的健康档案。",
        f"当前用户：{ctx.deps.current_user.email}",
        f"用户角色：{ctx.deps.current_user.role}",
        f"家庭空间：{ctx.deps.family_space_id}",
        f"今天：{datetime.now(UTC).date().isoformat()}",
        "重要规则：",
        "- 同一会话里允许切换咨询人，必须以本轮解析出的咨询人为准。",
        "- 回答健康问题前，优先调用工具查询，不要编造健康数据。",
        "- 写入健康档案必须通过工具完成，不要在文本里假装已经修改。",
        "- 高风险档案写入必须等待用户确认。",
        "- 健康档案建议与草稿统一使用 action 结构：必须提供 action、resource、target_member_id；update/delete 还必须提供 record_id。",
        "- 如果本轮咨询人无法唯一确定，且你需要读取或修改成员档案，先询问用户当前指的是哪位已授权家庭成员。",
        "- 若本轮已解析出咨询人，生成 HealthRecordAction 时默认使用该成员作为 target_member_id，除非用户明确要求操作其他已授权成员。",
        "- 用中文回答，默认简洁。",
    ]
    if ctx.deps.visible_members:
        visible_member_lines = ["当前用户可访问成员："]
        for member in ctx.deps.visible_members:
            visible_member_lines.append(
                f"- {member['name']}（id={member['id']}，permission={member['permission_level']}）"
            )
        parts.append("\n".join(visible_member_lines))
    if ctx.deps.focus_member_id:
        parts.append(
            f"本轮关注成员：{ctx.deps.focus_member_name or ctx.deps.focus_member_id}"
        )
        parts.append(f"本轮焦点来源：{ctx.deps.focus_resolution_source}")
        if ctx.deps.focus_changed:
            if ctx.deps.previous_focus_member_name:
                parts.append(
                    f"本轮发生了咨询人切换：从 {ctx.deps.previous_focus_member_name} 切换到 {ctx.deps.focus_member_name or ctx.deps.focus_member_id}。"
                )
            else:
                parts.append(
                    f"本轮已确定咨询人为：{ctx.deps.focus_member_name or ctx.deps.focus_member_id}。"
                )
    else:
        parts.append("本轮关注成员：尚未明确。")
        parts.append("如需读取或修改成员档案，请先确认当前咨询的是哪位已授权家庭成员。")
    if ctx.deps.page_context:
        parts.append(f"当前页面上下文：{ctx.deps.page_context}")
    if ctx.deps.attachments:
        attachment_lines = ["当前附件上下文："]
        for index, attachment in enumerate(ctx.deps.attachments, start=1):
            attachment_lines.append(
                f"{index}. 文件：{attachment.filename}（{attachment.media_type}，source={attachment.source_type}，OCR={'是' if attachment.ocr_used else '否'}）"
            )
            attachment_lines.append(f"   摘要：{attachment.excerpt}")
        attachment_lines.append("仅在需要时引用这些附件摘要，不要假设附件之外的内容。")
        parts.append("\n".join(attachment_lines))
    return "\n".join(parts)


def build_model(settings: Settings) -> Any | None:
    if not settings.ai_base_url or not settings.ai_api_key:
        return None
    return OpenAIChatModel(
        settings.ai_model,
        provider=OpenAIProvider(
            base_url=settings.ai_base_url,
            api_key=settings.ai_api_key,
        ),
    )
