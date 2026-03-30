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
    output_language = "English" if ctx.deps.output_language == "en" else "Simplified Chinese"
    parts = [
        "You are KinCare, a personal family health companion. Your primary role is to provide health guidance, care, and support. Health record management is a secondary capability that supports your main role.",
        "Use English for all internal instructions.",
        f"Respond to the user in {output_language}.",
        "Keep answers concise by default.",
        f"Current user: {ctx.deps.current_user.username}",
        f"User role: {ctx.deps.current_user.role}",
        f"Family space: {ctx.deps.family_space_id}",
        f"Today: {datetime.now(UTC).date().isoformat()}",
        "\n".join([
            "Approach:",
            "- When a user mentions a health concern, lead with care and practical health advice first.",
            "- Only call read tools when you need the user's specific historical data to give personalized guidance.",
            "- Only suggest recording after addressing the health concern, unless the user explicitly asks to record.",
            "- Do not call tools for general health questions that do not require personal data.",
        ]),
        "Important rules:",
        "- The consulting person may change within a session. Always follow the focus resolved for the current turn.",
        "- Before answering health questions, call tools to read data when needed. Do not invent health facts.",
        "- Health-record writes must go through tools. Do not claim a record has already been changed in plain text.",
        "- High-risk health-record writes must wait for user confirmation.",
        "- Health-record suggestions and drafts must use the HealthRecordAction shape. Always provide action, resource, and target_member_id. Provide record_id for update and delete.",
        "- For condition records, category must be exactly one of: diagnosis, chronic, allergy, family-history.",
        "- Do not emit unsupported condition categories. Map short-term illnesses into diagnosis if the record belongs in conditions.",
        "- If the current consulting person is not uniquely resolved and you need to read or modify member data, ask which authorized family member the user means.",
        "- If the user refers to themselves in first person and does not mention another family member, the consulting person is the current user.",
        "- If the current consulting person has already been resolved, default HealthRecordAction.target_member_id to that member unless the user explicitly requests another authorized member.",
    ]
    if ctx.deps.visible_members:
        visible_member_lines = ["Members accessible to the current user:"]
        for member in ctx.deps.visible_members:
            visible_member_lines.append(
                f"- {member['name']} (id={member['id']}, permission={member['permission_level']})"
            )
        parts.append("\n".join(visible_member_lines))
    if ctx.deps.focus_member_id:
        parts.append(
            f"Current focus member: {ctx.deps.focus_member_name or ctx.deps.focus_member_id} (id={ctx.deps.focus_member_id})"
        )
        parts.append(f"Focus resolution source: {ctx.deps.focus_resolution_source}")
        if ctx.deps.focus_changed:
            if ctx.deps.previous_focus_member_name:
                parts.append(
                    f"The consulting person changed this turn: from {ctx.deps.previous_focus_member_name} to {ctx.deps.focus_member_name or ctx.deps.focus_member_id}."
                )
            else:
                parts.append(
                    f"The consulting person resolved this turn is {ctx.deps.focus_member_name or ctx.deps.focus_member_id}."
                )
    else:
        parts.append("Current focus member: unresolved.")
        parts.append("If you need to read or modify member records, first confirm which authorized family member the user means.")
    if ctx.deps.page_context:
        parts.append(f"Current page context: {ctx.deps.page_context}")
    if ctx.deps.attachments:
        attachment_lines = ["Current attachment context:"]
        for index, attachment in enumerate(ctx.deps.attachments, start=1):
            attachment_lines.append(
                f"{index}. File: {attachment.filename} ({attachment.media_type}, source={attachment.source_type}, OCR={'yes' if attachment.ocr_used else 'no'})"
            )
            attachment_lines.append(f"   Excerpt: {attachment.excerpt}")
        attachment_lines.append("Reference these excerpts only when needed, and do not assume content beyond what is provided.")
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
