from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from app.ai.providers import OpenAICompatibleProvider, StubProvider
from app.ai.providers.base import AIProvider
from app.ai.tools import create_scheduled_task_tool, draft_health_record, read_member_summary
from app.core.config import Settings
from app.core.database import Database
from app.core.dependencies import CurrentUser
from app.services import chat_sessions
from app.services.health_records import ensure_member_access


@dataclass
class StreamEvent:
    name: str
    data: dict[str, Any]


class ChatOrchestrator:
    def __init__(
        self,
        *,
        database: Database,
        settings: Settings,
        scheduler: Any,
    ) -> None:
        self._database = database
        self._settings = settings
        self._scheduler = scheduler
        self._provider = self._create_provider()

    def _create_provider(self) -> AIProvider:
        if self._settings.ai_provider == "stub":
            return StubProvider()
        return OpenAICompatibleProvider(self._settings)

    def create_session(
        self,
        *,
        current_user: CurrentUser,
        member_id: str | None,
        page_context: str | None,
    ) -> dict[str, Any]:
        if member_id is not None:
            ensure_member_access(self._database, current_user, member_id, require_write=False)
        with self._database.connection() as connection:
            return chat_sessions.create_session(
                connection,
                user_id=current_user.id,
                family_space_id=current_user.family_space_id,
                member_id=member_id,
                page_context=page_context,
            )

    def handle_message(
        self,
        *,
        current_user: CurrentUser,
        session_id: str,
        content: str,
        member_id: str | None,
        page_context: str | None,
        document_ids: list[str],
    ) -> list[StreamEvent]:
        with self._database.connection() as connection:
            session = chat_sessions.get_session_by_id(connection, session_id)
            if session is None or session["family_space_id"] != current_user.family_space_id:
                raise ValueError("Chat session not found.")
            focus_member_id = member_id or session["member_id"]
            chat_sessions.create_message(
                connection,
                session_id=session_id,
                role="user",
                content=content,
                metadata={
                    "member_id": focus_member_id,
                    "page_context": page_context or session["page_context"],
                    "document_ids": document_ids,
                },
            )

        tool_result: dict[str, Any] | None = None
        if focus_member_id and "提醒" in content:
            tool_result = create_scheduled_task_tool(
                database=self._database,
                current_user=current_user,
                member_id=focus_member_id,
                scheduler=self._scheduler,
                message=content,
            )
        if tool_result is None:
            tool_result = draft_health_record(message=content)
        if tool_result is None and focus_member_id is not None:
            tool_result = read_member_summary(
                database=self._database,
                current_user=current_user,
                member_id=focus_member_id,
            )

        fallback_text = self._build_fallback_text(
            content=content,
            member_id=focus_member_id,
            tool_result=tool_result,
            document_ids=document_ids,
        )
        final_text = self._provider.generate_text(
            system_prompt="You are HomeVital's concise family health assistant.",
            user_prompt=content,
            fallback_text=fallback_text,
        )

        with self._database.connection() as connection:
            if tool_result is not None:
                chat_sessions.create_message(
                    connection,
                    session_id=session_id,
                    role="tool",
                    content=tool_result["content"],
                    event_type=tool_result["tool_name"],
                    metadata=tool_result,
                )
            chat_sessions.create_message(
                connection,
                session_id=session_id,
                role="assistant",
                content=final_text,
                metadata={"member_id": focus_member_id},
            )

        events = [
            StreamEvent(
                name="session.started",
                data={
                    "session_id": session_id,
                    "member_id": focus_member_id,
                },
            )
        ]
        if tool_result is not None:
            events.append(
                StreamEvent(
                    name="tool.started",
                    data={"tool_name": tool_result["tool_name"]},
                )
            )
            events.append(StreamEvent(name="tool.result", data=tool_result))
        events.append(StreamEvent(name="message.delta", data={"content": final_text}))
        events.append(StreamEvent(name="message.completed", data={"content": final_text}))
        return events

    def _build_fallback_text(
        self,
        *,
        content: str,
        member_id: str | None,
        tool_result: dict[str, Any] | None,
        document_ids: list[str],
    ) -> str:
        if tool_result is not None:
            if tool_result["tool_name"] == "draft_health_record":
                return "我已经整理出一条高风险健康记录草稿。请先确认，再写入正式档案。"
            if tool_result["tool_name"] == "read_member_summary":
                return f"{tool_result['content']}。如果需要，我可以继续帮您生成提醒或整理记录。"
            if tool_result["tool_name"] == "create_scheduled_task":
                return f"{tool_result['content']}。后续执行结果会写入提醒列表。"

        if document_ids:
            return "附件已挂接到本次会话，我会在需要时结合文档摘要继续分析。"
        if member_id is None:
            return "请先选择要关注的家庭成员，我再继续整理对应的健康信息。"
        return f"收到：{content.strip()}"


def format_sse_event(event: StreamEvent) -> str:
    return f"event: {event.name}\ndata: {json.dumps(event.data, ensure_ascii=False)}\n\n"
