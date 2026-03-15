from __future__ import annotations

import copy
import json
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

from pydantic_ai import Agent, DeferredToolRequests, DeferredToolResults, ModelMessagesTypeAdapter
from pydantic_ai.exceptions import UsageLimitExceeded
from pydantic_ai.messages import (
    FunctionToolCallEvent,
    FunctionToolResultEvent,
    PartDeltaEvent,
    ToolCallPart,
)
from pydantic_ai.usage import UsageLimits

from app.ai.agent import create_agent
from app.ai.deps import AIDeps
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
        self._agent = create_agent(settings)
        self._request_limit = 8

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

    def resolve_session(
        self,
        *,
        current_user: CurrentUser,
        session_id: str,
        member_id: str | None,
    ) -> tuple[dict[str, Any], str | None]:
        with self._database.connection() as connection:
            session = chat_sessions.get_session_by_id(connection, session_id)
        if session is None or session["family_space_id"] != current_user.family_space_id:
            raise ValueError("Chat session not found.")
        focus_member_id = member_id or session["member_id"]
        if focus_member_id is not None:
            ensure_member_access(self._database, current_user, focus_member_id, require_write=False)
        return session, focus_member_id

    async def stream_chat(
        self,
        *,
        current_user: CurrentUser,
        session_id: str,
        content: str,
        member_id: str | None,
        page_context: str | None,
    ) -> AsyncIterator[StreamEvent]:
        session, focus_member_id = self.resolve_session(
            current_user=current_user,
            session_id=session_id,
            member_id=member_id,
        )
        history = self._load_latest_message_history(session_id)
        effective_page_context = page_context or session["page_context"]

        with self._database.connection() as connection:
            chat_sessions.create_message(
                connection,
                session_id=session_id,
                role="user",
                content=content,
                metadata={
                    "member_id": focus_member_id,
                    "page_context": effective_page_context,
                },
            )

        deps = AIDeps(
            database=self._database,
            current_user=current_user,
            family_space_id=current_user.family_space_id,
            focus_member_id=focus_member_id,
            scheduler=self._scheduler,
            session_id=session_id,
            page_context=effective_page_context,
        )
        usage_limits = UsageLimits(request_limit=self._request_limit)
        yielded_delta = False

        yield StreamEvent(
            "session.started",
            {
                "session_id": session_id,
                "member_id": focus_member_id,
            },
        )

        if self._agent is None:
            error_event = StreamEvent(
                "tool.error",
                {
                    "tool_name": "agent",
                    "error": "AI 模型尚未配置。请设置 HOMEVITAL_AI_BASE_URL 和 HOMEVITAL_AI_API_KEY。",
                },
            )
            self._persist_tool_message(session_id, error_event)
            yield error_event
            return

        try:
            async with self._agent.iter(
                content,
                deps=deps,
                message_history=history,
                usage_limits=usage_limits,
            ) as run:
                async for node in run:
                    if Agent.is_model_request_node(node):
                        async with node.stream(run.ctx) as request_stream:
                            async for event in request_stream:
                                if isinstance(event, PartDeltaEvent) and hasattr(event.delta, "content_delta"):
                                    delta = str(event.delta.content_delta or "")
                                    if delta:
                                        yielded_delta = True
                                        yield StreamEvent("message.delta", {"content": delta})
                    elif Agent.is_call_tools_node(node):
                        async with node.stream(run.ctx) as tool_stream:
                            async for event in tool_stream:
                                if isinstance(event, FunctionToolCallEvent):
                                    yield StreamEvent("tool.started", {"tool_name": event.part.tool_name})
                                elif isinstance(event, FunctionToolResultEvent):
                                    tool_event = self._tool_result_event(event)
                                    self._persist_tool_message(session_id, tool_event)
                                    yield tool_event

                result = run.result
        except UsageLimitExceeded as error:
            error_event = StreamEvent("tool.error", {"tool_name": "agent", "error": str(error)})
            self._persist_tool_message(session_id, error_event)
            yield error_event
            return

        history_payload = self._serialize_history(result.all_messages_json())
        if isinstance(result.output, DeferredToolRequests):
            draft_event = self._deferred_draft_event(result.output)
            self._persist_tool_message(
                session_id,
                draft_event,
                extra_metadata={"message_history": history_payload},
            )
            yield draft_event
            return

        assistant_text = str(result.output)
        if assistant_text and not yielded_delta:
            yield StreamEvent("message.delta", {"content": assistant_text})

        with self._database.connection() as connection:
            chat_sessions.create_message(
                connection,
                session_id=session_id,
                role="assistant",
                content=assistant_text,
                metadata={
                    "member_id": focus_member_id,
                    "message_history": history_payload,
                },
            )
        yield StreamEvent("message.completed", {"content": assistant_text})

    async def confirm_draft(
        self,
        *,
        current_user: CurrentUser,
        session_id: str,
        approvals: dict[str, bool],
        edits: dict[str, dict[str, Any]],
    ) -> dict[str, Any]:
        session, focus_member_id = self.resolve_session(
            current_user=current_user,
            session_id=session_id,
            member_id=None,
        )
        pending_message = self._load_latest_pending_draft_message(session_id)
        if pending_message is None:
            raise ValueError("Pending draft not found.")

        metadata = pending_message["metadata"] or {}
        raw_history = copy.deepcopy(metadata.get("message_history") or [])
        if not raw_history:
            raise ValueError("Pending draft history is missing.")

        if edits:
            raw_history = self._apply_edits_to_history(raw_history, edits)

        history = ModelMessagesTypeAdapter.validate_python(raw_history)
        deps = AIDeps(
            database=self._database,
            current_user=current_user,
            family_space_id=current_user.family_space_id,
            focus_member_id=focus_member_id,
            scheduler=self._scheduler,
            session_id=session_id,
            page_context=session["page_context"],
        )
        created_counts = {
            "observations": 0,
            "conditions": 0,
            "medications": 0,
            "encounters": 0,
        }

        if self._agent is None:
            return {
                "created_counts": created_counts,
                "assistant_message": "AI 模型尚未配置，无法继续确认草稿。",
            }

        try:
            async with self._agent.iter(
                deps=deps,
                message_history=history,
                deferred_tool_results=DeferredToolResults(approvals=approvals),
                usage_limits=UsageLimits(request_limit=self._request_limit),
            ) as run:
                async for node in run:
                    if Agent.is_call_tools_node(node):
                        async with node.stream(run.ctx) as tool_stream:
                            async for event in tool_stream:
                                if isinstance(event, FunctionToolResultEvent):
                                    tool_event = self._tool_result_event(event)
                                    self._persist_tool_message(session_id, tool_event)
                                    if tool_event.name == "tool.write_ok":
                                        self._merge_created_counts(created_counts, tool_event.data)
                result = run.result
        except UsageLimitExceeded as error:
            error_event = StreamEvent("tool.error", {"tool_name": "agent", "error": str(error)})
            self._persist_tool_message(session_id, error_event)
            return {
                "created_counts": created_counts,
                "assistant_message": "审批后的执行超过循环上限，请重试。",
            }

        history_payload = self._serialize_history(result.all_messages_json())
        if isinstance(result.output, DeferredToolRequests):
            draft_event = self._deferred_draft_event(result.output)
            self._persist_tool_message(
                session_id,
                draft_event,
                extra_metadata={"message_history": history_payload},
            )
            return {
                "created_counts": created_counts,
                "assistant_message": "",
            }

        assistant_text = str(result.output)
        with self._database.connection() as connection:
            chat_sessions.create_message(
                connection,
                session_id=session_id,
                role="assistant",
                content=assistant_text,
                metadata={
                    "member_id": focus_member_id,
                    "message_history": history_payload,
                },
            )
        return {
            "created_counts": created_counts,
            "assistant_message": assistant_text,
        }

    def _load_latest_message_history(self, session_id: str) -> list[Any] | None:
        with self._database.connection() as connection:
            messages = chat_sessions.list_messages_for_session(connection, session_id)

        for message in reversed(messages):
            metadata = message.get("metadata") or {}
            history = metadata.get("message_history")
            if history:
                return ModelMessagesTypeAdapter.validate_python(history)
        return None

    def _load_latest_pending_draft_message(self, session_id: str) -> dict[str, Any] | None:
        with self._database.connection() as connection:
            messages = chat_sessions.list_messages_for_session(connection, session_id)

        for message in reversed(messages):
            if message["role"] != "tool" or message.get("event_type") != "tool.draft":
                continue
            return message
        return None

    def _persist_tool_message(
        self,
        session_id: str,
        event: StreamEvent,
        *,
        extra_metadata: dict[str, Any] | None = None,
    ) -> None:
        metadata = dict(event.data)
        if extra_metadata:
            metadata.update(extra_metadata)

        with self._database.connection() as connection:
            chat_sessions.create_message(
                connection,
                session_id=session_id,
                role="tool",
                content=str(event.data.get("content", event.name)),
                event_type=event.name,
                metadata=metadata,
            )

    def _tool_result_event(self, event: FunctionToolResultEvent) -> StreamEvent:
        tool_name = getattr(event.result, "tool_name", "unknown")
        payload = {"tool_name": tool_name}
        content = getattr(event.result, "content", None)
        if isinstance(content, dict):
            payload.update(content)
        else:
            payload["content"] = str(content)

        if tool_name == "suggest_record_update":
            return StreamEvent("tool.suggest", payload)
        if tool_name.startswith("draft_"):
            return StreamEvent("tool.write_ok", payload)
        return StreamEvent("tool.result", payload)

    def _deferred_draft_event(self, requests: DeferredToolRequests) -> StreamEvent:
        if not requests.approvals:
            return StreamEvent(
                "tool.draft",
                {
                    "tool_name": "draft",
                    "requires_confirmation": True,
                    "draft": {},
                    "tool_call_id": None,
                },
            )

        call = requests.approvals[0]
        draft = self._draft_from_tool_call(call)
        return StreamEvent(
            "tool.draft",
            {
                "tool_name": call.tool_name,
                "tool_call_id": call.tool_call_id,
                "requires_confirmation": True,
                "draft": draft,
                "content": "已生成待确认草稿。",
            },
        )

    def _draft_from_tool_call(self, call: ToolCallPart) -> dict[str, Any]:
        args = call.args_as_dict()
        empty_draft = {
            "summary": "",
            "observations": [],
            "conditions": [],
            "medications": [],
            "encounters": [],
        }
        if call.tool_name == "draft_observations":
            empty_draft["observations"] = args.get("observations", [])
        elif call.tool_name == "draft_conditions":
            empty_draft["conditions"] = args.get("conditions", [])
        elif call.tool_name == "draft_medications":
            empty_draft["medications"] = args.get("medications", [])
        elif call.tool_name == "draft_encounter":
            empty_draft["encounters"] = args.get("encounters", [])
        return empty_draft

    def _apply_edits_to_history(
        self,
        raw_history: list[dict[str, Any]],
        edits: dict[str, dict[str, Any]],
    ) -> list[dict[str, Any]]:
        updated = copy.deepcopy(raw_history)
        for message in updated:
            for part in message.get("parts", []):
                tool_call_id = part.get("tool_call_id")
                if tool_call_id not in edits:
                    continue
                tool_name = str(part.get("tool_name"))
                part["args"] = self._tool_args_from_edit(tool_name, edits[tool_call_id])
        return updated

    def _tool_args_from_edit(self, tool_name: str, draft: dict[str, Any]) -> dict[str, Any]:
        if tool_name == "draft_observations":
            return {"observations": draft.get("observations", [])}
        if tool_name == "draft_conditions":
            return {"conditions": draft.get("conditions", [])}
        if tool_name == "draft_medications":
            return {"medications": draft.get("medications", [])}
        if tool_name == "draft_encounter":
            return {"encounters": draft.get("encounters", [])}
        return {}

    def _merge_created_counts(self, counts: dict[str, int], payload: dict[str, Any]) -> None:
        resource_type = str(payload.get("resource_type", ""))
        count = int(payload.get("count", 0))
        if resource_type in counts:
            counts[resource_type] += count

    def _serialize_history(self, history_json: bytes) -> list[dict[str, Any]]:
        return list(json.loads(history_json.decode("utf-8")))


def format_sse_event(event: StreamEvent) -> str:
    return f"event: {event.name}\ndata: {json.dumps(event.data, ensure_ascii=False)}\n\n"
