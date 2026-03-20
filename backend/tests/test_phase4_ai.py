from __future__ import annotations

from contextlib import ExitStack
from dataclasses import replace
from datetime import UTC, datetime
import importlib
import json
import sys
from typing import Any
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient


def _clear_app_modules() -> None:
    for module_name in list(sys.modules):
        if module_name == "app" or module_name.startswith("app."):
            sys.modules.pop(module_name, None)


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch, tmp_path: Any) -> TestClient:
    monkeypatch.setenv("HOMEVITAL_DB_PATH", str(tmp_path / "homevital.db"))
    monkeypatch.setenv("HOMEVITAL_JWT_SECRET", "phase-4-test-secret")
    monkeypatch.setenv("HOMEVITAL_ACCESS_TOKEN_TTL_SECONDS", "900")
    monkeypatch.setenv("HOMEVITAL_REFRESH_TOKEN_TTL_SECONDS", "3600")
    monkeypatch.setenv("HOMEVITAL_SKIP_DOTENV", "1")
    monkeypatch.setenv("HOMEVITAL_AI_BASE_URL", "https://example.invalid/v1")
    monkeypatch.setenv("HOMEVITAL_AI_API_KEY", "test-key")
    monkeypatch.setenv("HOMEVITAL_AI_MODEL", "test-model")
    monkeypatch.setenv("HOMEVITAL_SCHEDULER_ENABLED", "1")

    _clear_app_modules()
    main_module = importlib.import_module("app.main")

    with TestClient(main_module.app) as test_client:
        yield test_client


@pytest.fixture
def unconfigured_client(monkeypatch: pytest.MonkeyPatch, tmp_path: Any) -> TestClient:
    monkeypatch.setenv("HOMEVITAL_DB_PATH", str(tmp_path / "homevital.db"))
    monkeypatch.setenv("HOMEVITAL_JWT_SECRET", "phase-4-test-secret")
    monkeypatch.setenv("HOMEVITAL_ACCESS_TOKEN_TTL_SECONDS", "900")
    monkeypatch.setenv("HOMEVITAL_REFRESH_TOKEN_TTL_SECONDS", "3600")
    monkeypatch.setenv("HOMEVITAL_SKIP_DOTENV", "1")
    monkeypatch.delenv("HOMEVITAL_AI_BASE_URL", raising=False)
    monkeypatch.delenv("HOMEVITAL_AI_API_KEY", raising=False)
    monkeypatch.setenv("HOMEVITAL_AI_MODEL", "test-model")
    monkeypatch.setenv("HOMEVITAL_SCHEDULER_ENABLED", "1")

    _clear_app_modules()
    main_module = importlib.import_module("app.main")

    with TestClient(main_module.app) as test_client:
        yield test_client


@pytest.fixture
def custom_schedule_client(monkeypatch: pytest.MonkeyPatch, tmp_path: Any) -> TestClient:
    monkeypatch.setenv("HOMEVITAL_DB_PATH", str(tmp_path / "homevital.db"))
    monkeypatch.setenv("HOMEVITAL_JWT_SECRET", "phase-4-test-secret")
    monkeypatch.setenv("HOMEVITAL_ACCESS_TOKEN_TTL_SECONDS", "900")
    monkeypatch.setenv("HOMEVITAL_REFRESH_TOKEN_TTL_SECONDS", "3600")
    monkeypatch.setenv("HOMEVITAL_SKIP_DOTENV", "1")
    monkeypatch.setenv("HOMEVITAL_AI_BASE_URL", "https://example.invalid/v1")
    monkeypatch.setenv("HOMEVITAL_AI_API_KEY", "test-key")
    monkeypatch.setenv("HOMEVITAL_AI_MODEL", "test-model")
    monkeypatch.setenv("HOMEVITAL_SCHEDULER_ENABLED", "1")
    monkeypatch.setenv("HOMEVITAL_HEALTH_SUMMARY_REFRESH_HOUR", "4")
    monkeypatch.setenv("HOMEVITAL_HEALTH_SUMMARY_REFRESH_MINUTE", "15")
    monkeypatch.setenv("HOMEVITAL_CARE_PLAN_REFRESH_HOUR", "6")
    monkeypatch.setenv("HOMEVITAL_CARE_PLAN_REFRESH_MINUTE", "45")

    _clear_app_modules()
    main_module = importlib.import_module("app.main")

    with TestClient(main_module.app) as test_client:
        yield test_client


def register_user(
    client: TestClient,
    *,
    email: str,
    password: str,
    name: str,
) -> dict[str, Any]:
    response = client.post(
        "/api/auth/register",
        json={"email": email, "password": password, "name": name},
    )
    assert response.status_code == 201, response.text
    return response.json()


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def create_managed_member(client: TestClient, admin_access_token: str, name: str) -> dict[str, Any]:
    response = client.post(
        "/api/members",
        json={"name": name, "gender": "female"},
        headers=auth_headers(admin_access_token),
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_session(client: TestClient, *, token: str, member_id: str | None, page_context: str) -> str:
    response = client.post(
        "/api/chat/sessions",
        headers=auth_headers(token),
        json={"member_id": member_id, "page_context": page_context},
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def create_observation(
    client: TestClient,
    *,
    token: str,
    member_id: str,
    code: str = "bp-systolic",
    display_name: str = "收缩压",
    value: float = 126.0,
    unit: str = "mmHg",
) -> dict[str, Any]:
    response = client.post(
        f"/api/members/{member_id}/observations",
        headers=auth_headers(token),
        json={
            "category": "chronic-vitals",
            "code": code,
            "display_name": display_name,
            "value": value,
            "unit": unit,
            "effective_at": "2026-03-12T08:00:00+08:00",
            "source": "manual",
            "notes": "早餐后测量",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_medication(
    client: TestClient,
    *,
    token: str,
    member_id: str,
    name: str = "缬沙坦",
) -> dict[str, Any]:
    response = client.post(
        f"/api/members/{member_id}/medications",
        headers=auth_headers(token),
        json={
            "name": name,
            "indication": "降压",
            "dosage_description": "80mg 每日一次",
            "status": "active",
            "source": "manual",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_sleep_record(client: TestClient, *, token: str, member_id: str, total_minutes: int = 460) -> dict[str, Any]:
    response = client.post(
        f"/api/members/{member_id}/sleep-records",
        headers=auth_headers(token),
        json={
            "start_at": "2026-03-11T22:30:00+08:00",
            "end_at": "2026-03-12T06:10:00+08:00",
            "total_minutes": total_minutes,
            "deep_minutes": 90,
            "rem_minutes": 110,
            "light_minutes": 220,
            "awake_minutes": 40,
            "efficiency_score": 90.0,
            "is_nap": False,
            "source": "device",
            "device_name": "Apple Watch",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_workout_record(client: TestClient, *, token: str, member_id: str, duration_minutes: int = 48) -> dict[str, Any]:
    response = client.post(
        f"/api/members/{member_id}/workout-records",
        headers=auth_headers(token),
        json={
            "type": "walking",
            "start_at": "2026-03-12T07:00:00+08:00",
            "end_at": "2026-03-12T07:48:00+08:00",
            "duration_minutes": duration_minutes,
            "energy_burned": 180.0,
            "distance_meters": 3500.0,
            "avg_heart_rate": 110,
            "source": "device",
            "device_name": "Apple Watch",
            "notes": "晨间快走",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_care_plan(client: TestClient, *, token: str, member_id: str, title: str = "早餐后服药") -> dict[str, Any]:
    response = client.post(
        f"/api/members/{member_id}/care-plans",
        headers=auth_headers(token),
        json={
            "category": "medication-reminder",
            "title": title,
            "description": "08:30 服用降压药",
            "status": "active",
            "scheduled_at": "2026-03-12T08:30:00+08:00",
            "generated_by": "manual",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def parse_sse_events(response: Any) -> list[dict[str, Any]]:
    raw = "".join(response.iter_text())
    blocks = [block.strip() for block in raw.split("\n\n") if block.strip()]
    events: list[dict[str, Any]] = []
    for block in blocks:
        event_name = ""
        payload = ""
        for line in block.splitlines():
            if line.startswith("event:"):
                event_name = line.removeprefix("event:").strip()
            if line.startswith("data:"):
                payload = line.removeprefix("data:").strip()
        events.append(
            {
                "event": event_name,
                "data": json.loads(payload) if payload else None,
            }
        )
    return events


def stream_chat_message(
    client: TestClient,
    *,
    token: str,
    session_id: str,
    member_id: str,
    page_context: str,
    content: str,
    attachments: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    with client.stream(
        "POST",
        f"/api/chat/sessions/{session_id}/messages",
        headers=auth_headers(token),
        json={
            "content": content,
            "member_id": member_id,
            "page_context": page_context,
            "attachments": attachments or [],
        },
    ) as response:
        assert response.status_code == 200, response.text
        assert response.headers["content-type"].startswith("text/event-stream")
        return parse_sse_events(response)


def override_agent_model(client: TestClient, *, function: Any, stream_function: Any | None = None) -> Any:
    function_models = importlib.import_module("pydantic_ai.models.function")
    messages_module = importlib.import_module("pydantic_ai.messages")
    FunctionModel = function_models.FunctionModel
    DeltaToolCall = function_models.DeltaToolCall
    ModelResponse = messages_module.ModelResponse
    TextPart = messages_module.TextPart
    ToolCallPart = messages_module.ToolCallPart

    async def default_stream_function(messages: list[Any], info: Any) -> Any:
        response = await function(messages, info)
        assert isinstance(response, ModelResponse)
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

    return client.app.state.chat_orchestrator._agent.override(
        model=FunctionModel(function=function, stream_function=stream_function or default_stream_function),
    )


def override_daily_generation_models(
    client: TestClient,
    *,
    summary_function: Any | None = None,
    care_plan_function: Any | None = None,
) -> ExitStack:
    function_models = importlib.import_module("pydantic_ai.models.function")
    FunctionModel = function_models.FunctionModel

    generator = client.app.state.scheduler._daily_generator
    stack = ExitStack()
    if summary_function is not None:
        stack.enter_context(generator.summary_agent.override(model=FunctionModel(function=summary_function)))
    if care_plan_function is not None:
        stack.enter_context(generator.care_plan_agent.override(model=FunctionModel(function=care_plan_function)))
    return stack


def shanghai_today(hour: int, minute: int = 0) -> str:
    now = datetime.now(ZoneInfo("Asia/Shanghai"))
    return now.replace(hour=hour, minute=minute, second=0, microsecond=0).isoformat()


def test_chat_session_message_stream_reads_authorized_data_and_returns_tool_events(client: TestClient) -> None:
    admin = register_user(client, email="owner@example.com", password="Secret123!", name="管理员")
    managed_member = create_managed_member(client, admin["tokens"]["access_token"], "奶奶")
    create_observation(client, token=admin["tokens"]["access_token"], member_id=managed_member["id"])
    create_care_plan(client, token=admin["tokens"]["access_token"], member_id=managed_member["id"])
    session_id = create_session(
        client,
        token=admin["tokens"]["access_token"],
        member_id=managed_member["id"],
        page_context="home",
    )

    messages_module = importlib.import_module("pydantic_ai.messages")
    ModelResponse = messages_module.ModelResponse
    TextPart = messages_module.TextPart
    ToolCallPart = messages_module.ToolCallPart

    async def scripted_model(messages: list[Any], info: Any) -> Any:
        del info
        latest_part = messages[-1].parts[-1]
        if getattr(latest_part, "part_kind", None) == "tool-return":
            return ModelResponse(parts=[TextPart("奶奶最近收缩压 126mmHg，并且有一条早餐后服药提醒。")])
        return ModelResponse(parts=[ToolCallPart("get_member_summary", {})])

    with override_agent_model(client, function=scripted_model):
        events = stream_chat_message(
            client,
            token=admin["tokens"]["access_token"],
            session_id=session_id,
            member_id=managed_member["id"],
            page_context="home",
            content="请看看奶奶最近的指标和提醒",
        )

    assert [item["event"] for item in events] == [
        "session.started",
        "tool.started",
        "tool.result",
        "message.delta",
        "message.completed",
    ]
    assert events[2]["data"]["tool_name"] == "get_member_summary"
    assert "收缩压" in events[2]["data"]["content"]
    assert "早餐后服药" in events[4]["data"]["content"]


def test_chat_returns_tool_error_when_ai_is_not_configured(unconfigured_client: TestClient) -> None:
    admin = register_user(unconfigured_client, email="owner@example.com", password="Secret123!", name="管理员")
    managed_member = create_managed_member(unconfigured_client, admin["tokens"]["access_token"], "奶奶")
    session_id = create_session(
        unconfigured_client,
        token=admin["tokens"]["access_token"],
        member_id=managed_member["id"],
        page_context="home",
    )

    events = stream_chat_message(
        unconfigured_client,
        token=admin["tokens"]["access_token"],
        session_id=session_id,
        member_id=managed_member["id"],
        page_context="home",
        content="帮我看看今天的数据",
    )

    assert [item["event"] for item in events] == ["session.started", "tool.error"]
    assert "AI" in events[1]["data"]["error"]
    assert "配置" in events[1]["data"]["error"]


def test_chat_cannot_read_unauthorized_member_data(client: TestClient) -> None:
    admin = register_user(client, email="owner@example.com", password="Secret123!", name="管理员")
    member = register_user(client, email="viewer@example.com", password="Secret123!", name="普通成员")
    managed_member = create_managed_member(client, admin["tokens"]["access_token"], "外婆")

    response = client.post(
        "/api/chat/sessions",
        headers=auth_headers(member["tokens"]["access_token"]),
        json={"member_id": managed_member["id"], "page_context": "home"},
    )

    assert response.status_code == 403


def test_chat_session_list_returns_recent_sessions_with_generated_preview(unconfigured_client: TestClient) -> None:
    admin = register_user(unconfigured_client, email="owner@example.com", password="Secret123!", name="管理员")
    managed_member = create_managed_member(unconfigured_client, admin["tokens"]["access_token"], "奶奶")

    first_session_id = create_session(
        unconfigured_client,
        token=admin["tokens"]["access_token"],
        member_id=managed_member["id"],
        page_context="home",
    )
    stream_chat_message(
        unconfigured_client,
        token=admin["tokens"]["access_token"],
        session_id=first_session_id,
        member_id=managed_member["id"],
        page_context="home",
        content="帮我回顾奶奶今天早上的血压和早餐后用药提醒",
    )

    second_session_id = create_session(
        unconfigured_client,
        token=admin["tokens"]["access_token"],
        member_id=managed_member["id"],
        page_context="home",
    )
    stream_chat_message(
        unconfigured_client,
        token=admin["tokens"]["access_token"],
        session_id=second_session_id,
        member_id=managed_member["id"],
        page_context="home",
        content="记录奶奶午睡后心率偏快，晚点继续跟进",
    )

    response = unconfigured_client.get(
        "/api/chat/sessions",
        headers=auth_headers(admin["tokens"]["access_token"]),
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert [item["id"] for item in payload] == [second_session_id, first_session_id]
    assert payload[0]["member_id"] == managed_member["id"]
    assert payload[0]["title"] == "记录奶奶午睡后心率偏快，晚点继续跟进"
    assert payload[0]["summary"] == "记录奶奶午睡后心率偏快，晚点继续跟进"
    assert payload[0]["updated_at"] >= payload[1]["updated_at"]


def test_chat_session_messages_endpoint_returns_owned_history_without_internal_trace(client: TestClient) -> None:
    admin = register_user(client, email="owner@example.com", password="Secret123!", name="管理员")
    managed_member = create_managed_member(client, admin["tokens"]["access_token"], "奶奶")
    session_id = create_session(
        client,
        token=admin["tokens"]["access_token"],
        member_id=managed_member["id"],
        page_context="home",
    )

    messages_module = importlib.import_module("pydantic_ai.messages")
    ModelResponse = messages_module.ModelResponse
    TextPart = messages_module.TextPart
    ToolCallPart = messages_module.ToolCallPart

    async def scripted_model(messages: list[Any], info: Any) -> Any:
        del info
        latest_part = messages[-1].parts[-1]
        if getattr(latest_part, "part_kind", None) == "tool-return":
            return ModelResponse(parts=[TextPart("奶奶最近血压稳定，早餐后服药提醒保持即可。")])
        return ModelResponse(parts=[ToolCallPart("get_member_summary", {})])

    with override_agent_model(client, function=scripted_model):
        stream_chat_message(
            client,
            token=admin["tokens"]["access_token"],
            session_id=session_id,
            member_id=managed_member["id"],
            page_context="home",
            content="请总结奶奶今天的血压和提醒",
        )

    response = client.get(
        f"/api/chat/sessions/{session_id}/messages",
        headers=auth_headers(admin["tokens"]["access_token"]),
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert [item["role"] for item in payload] == ["user", "tool", "assistant"]
    assert payload[0]["content"] == "请总结奶奶今天的血压和提醒"
    assert payload[1]["event_type"] == "tool.result"
    assert payload[2]["content"] == "奶奶最近血压稳定，早餐后服药提醒保持即可。"
    assert "message_history" not in (payload[2]["metadata"] or {})


def test_chat_follow_up_message_falls_back_when_stream_returns_empty(client: TestClient) -> None:
    admin = register_user(client, email="owner@example.com", password="Secret123!", name="管理员")
    managed_member = create_managed_member(client, admin["tokens"]["access_token"], "奶奶")
    session_id = create_session(
        client,
        token=admin["tokens"]["access_token"],
        member_id=managed_member["id"],
        page_context="home",
    )

    messages_module = importlib.import_module("pydantic_ai.messages")
    ModelResponse = messages_module.ModelResponse
    TextPart = messages_module.TextPart

    async def scripted_model(messages: list[Any], info: Any) -> Any:
        del info
        latest_part = messages[-1].parts[-1]
        return ModelResponse(parts=[TextPart(f"已回复：{latest_part.content}")])

    async def scripted_stream_model(messages: list[Any], info: Any) -> Any:
        del info
        latest_part = messages[-1].parts[-1]
        if latest_part.content == "再补充一下今天晚上的情况":
            if False:
                yield ""
            return
        yield str(f"已回复：{latest_part.content}")

    with override_agent_model(
        client,
        function=scripted_model,
        stream_function=scripted_stream_model,
    ):
        first_events = stream_chat_message(
            client,
            token=admin["tokens"]["access_token"],
            session_id=session_id,
            member_id=managed_member["id"],
            page_context="home",
            content="先总结一下今天白天的情况",
        )
        second_events = stream_chat_message(
            client,
            token=admin["tokens"]["access_token"],
            session_id=session_id,
            member_id=managed_member["id"],
            page_context="home",
            content="再补充一下今天晚上的情况",
        )

    assert first_events[-1]["event"] == "message.completed"
    assert first_events[-1]["data"]["content"] == "已回复：先总结一下今天白天的情况"
    assert second_events[-1]["event"] == "message.completed"
    assert second_events[-1]["data"]["content"] == "已回复：再补充一下今天晚上的情况"

    response = client.get(
        f"/api/chat/sessions/{session_id}/messages",
        headers=auth_headers(admin["tokens"]["access_token"]),
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert [item["role"] for item in payload] == ["user", "assistant", "user", "assistant"]
    assert payload[-1]["content"] == "已回复：再补充一下今天晚上的情况"


def test_chat_stream_emits_delta_for_single_text_chunk(client: TestClient) -> None:
    admin = register_user(client, email="owner@example.com", password="Secret123!", name="管理员")
    managed_member = create_managed_member(client, admin["tokens"]["access_token"], "奶奶")
    session_id = create_session(
        client,
        token=admin["tokens"]["access_token"],
        member_id=managed_member["id"],
        page_context="home",
    )

    messages_module = importlib.import_module("pydantic_ai.messages")
    ModelResponse = messages_module.ModelResponse
    TextPart = messages_module.TextPart

    async def scripted_model(messages: list[Any], info: Any) -> Any:
        del messages, info
        return ModelResponse(parts=[TextPart("奶奶今天整体情况稳定。")])

    async def scripted_stream_model(messages: list[Any], info: Any) -> Any:
        del messages, info
        yield "奶奶今天整体情况稳定。"

    with override_agent_model(
        client,
        function=scripted_model,
        stream_function=scripted_stream_model,
    ):
        events = stream_chat_message(
            client,
            token=admin["tokens"]["access_token"],
            session_id=session_id,
            member_id=managed_member["id"],
            page_context="home",
            content="总结一下奶奶今天的情况",
        )

    assert [item["event"] for item in events] == [
        "session.started",
        "message.delta",
        "message.completed",
    ]
    assert events[1]["data"]["content"] == "奶奶今天整体情况稳定。"
    assert events[2]["data"]["content"] == "奶奶今天整体情况稳定。"


def test_chat_session_messages_endpoint_rejects_other_users_session_access(unconfigured_client: TestClient) -> None:
    admin = register_user(unconfigured_client, email="owner@example.com", password="Secret123!", name="管理员")
    member = register_user(unconfigured_client, email="viewer@example.com", password="Secret123!", name="普通成员")
    session_id = create_session(
        unconfigured_client,
        token=admin["tokens"]["access_token"],
        member_id=None,
        page_context="home",
    )

    response = unconfigured_client.get(
        f"/api/chat/sessions/{session_id}/messages",
        headers=auth_headers(member["tokens"]["access_token"]),
    )

    assert response.status_code == 404


def test_chat_explicit_extract_emits_health_record_draft_without_care_plan_entries(client: TestClient) -> None:
    admin = register_user(client, email="owner@example.com", password="Secret123!", name="管理员")
    managed_member = create_managed_member(client, admin["tokens"]["access_token"], "奶奶")
    session_id = create_session(
        client,
        token=admin["tokens"]["access_token"],
        member_id=managed_member["id"],
        page_context="member-profile",
    )

    messages_module = importlib.import_module("pydantic_ai.messages")
    ModelResponse = messages_module.ModelResponse
    ToolCallPart = messages_module.ToolCallPart

    async def scripted_model(messages: list[Any], info: Any) -> Any:
        del messages, info
        return ModelResponse(
            parts=[
                ToolCallPart(
                    "draft_health_record_actions",
                    {
                        "summary": "",
                        "actions": [
                            {
                                "action": "create",
                                "resource": "observations",
                                "target_member_id": managed_member["id"],
                                "payload": {
                                    "category": "body-vitals",
                                    "code": "heart-rate",
                                    "display_name": "心率",
                                    "value": 72.0,
                                    "unit": "bpm",
                                    "effective_at": "2026-03-12T08:00:00+08:00",
                                },
                            }
                        ],
                    },
                )
            ]
        )

    with override_agent_model(client, function=scripted_model):
        events = stream_chat_message(
            client,
            token=admin["tokens"]["access_token"],
            session_id=session_id,
            member_id=managed_member["id"],
            page_context="member-profile",
            content="帮我提取奶奶今天心率 72 到档案里",
        )

    draft_event = next(item for item in events if item["event"] == "tool.draft")
    assert draft_event["data"]["tool_name"] == "draft_health_record_actions"
    assert draft_event["data"]["requires_confirmation"] is True
    action = draft_event["data"]["draft"]["actions"][0]
    assert action["action"] == "create"
    assert action["resource"] == "observations"
    assert action["target_member_id"] == managed_member["id"]
    assert action["payload"]["code"] == "heart-rate"

    observations_response = client.get(
        f"/api/members/{managed_member['id']}/observations",
        headers=auth_headers(admin["tokens"]["access_token"]),
    )
    assert observations_response.status_code == 200, observations_response.text
    assert observations_response.json() == []


def test_chat_confirm_draft_writes_records_and_returns_assistant_message(client: TestClient) -> None:
    admin = register_user(client, email="owner@example.com", password="Secret123!", name="管理员")
    managed_member = create_managed_member(client, admin["tokens"]["access_token"], "奶奶")
    session_id = create_session(
        client,
        token=admin["tokens"]["access_token"],
        member_id=managed_member["id"],
        page_context="member-profile",
    )

    messages_module = importlib.import_module("pydantic_ai.messages")
    ModelResponse = messages_module.ModelResponse
    TextPart = messages_module.TextPart
    ToolCallPart = messages_module.ToolCallPart

    async def scripted_model(messages: list[Any], info: Any) -> Any:
        del info
        latest_part = messages[-1].parts[-1]
        if getattr(latest_part, "part_kind", None) == "tool-return":
            return ModelResponse(parts=[TextPart("已将这条心率记录保存到奶奶的健康档案。")])
        return ModelResponse(
            parts=[
                ToolCallPart(
                    "draft_health_record_actions",
                    {
                        "summary": "",
                        "actions": [
                            {
                                "action": "create",
                                "resource": "observations",
                                "target_member_id": managed_member["id"],
                                "payload": {
                                    "category": "body-vitals",
                                    "code": "heart-rate",
                                    "display_name": "心率",
                                    "value": 72.0,
                                    "unit": "bpm",
                                    "effective_at": "2026-03-12T08:00:00+08:00",
                                },
                            }
                        ],
                    },
                )
            ]
        )

    with override_agent_model(client, function=scripted_model):
        events = stream_chat_message(
            client,
            token=admin["tokens"]["access_token"],
            session_id=session_id,
            member_id=managed_member["id"],
            page_context="member-profile",
            content="帮我提取奶奶今天心率 72 到档案里",
        )
        draft_event = next(item for item in events if item["event"] == "tool.draft")
        tool_call_id = draft_event["data"]["tool_call_id"]

        confirm_response = client.post(
            f"/api/chat/{session_id}/confirm-draft",
            headers=auth_headers(admin["tokens"]["access_token"]),
            json={
                "approvals": {tool_call_id: True},
                "edits": {},
            },
        )

    assert confirm_response.status_code == 200, confirm_response.text
    assert confirm_response.json()["created_counts"] == {
        "observations": 1,
        "conditions": 0,
        "medications": 0,
        "encounters": 0,
    }
    assert "已" in confirm_response.json()["assistant_message"]

    observations_response = client.get(
        f"/api/members/{managed_member['id']}/observations",
        headers=auth_headers(admin["tokens"]["access_token"]),
    )
    assert observations_response.status_code == 200, observations_response.text
    assert observations_response.json()[0]["source"] == "ai-extract"


def test_chat_analysis_emits_suggestion_without_writing_records(client: TestClient) -> None:
    admin = register_user(client, email="owner@example.com", password="Secret123!", name="管理员")
    managed_member = create_managed_member(client, admin["tokens"]["access_token"], "奶奶")
    session_id = create_session(
        client,
        token=admin["tokens"]["access_token"],
        member_id=managed_member["id"],
        page_context="member-profile",
    )

    messages_module = importlib.import_module("pydantic_ai.messages")
    ModelResponse = messages_module.ModelResponse
    TextPart = messages_module.TextPart
    ToolCallPart = messages_module.ToolCallPart

    async def scripted_model(messages: list[Any], info: Any) -> Any:
        del info
        latest_part = messages[-1].parts[-1]
        if getattr(latest_part, "part_kind", None) == "tool-return":
            return ModelResponse(parts=[TextPart("这条心率目前看起来正常，我也整理出了可录入建议。")])
        return ModelResponse(
            parts=[
                ToolCallPart(
                    "suggest_record_update",
                    {
                        "suggestion_summary": "识别到一条可录入的心率记录。",
                        "draft": {
                            "summary": "建议保存心率",
                            "actions": [
                                {
                                    "action": "create",
                                    "resource": "observations",
                                    "target_member_id": managed_member["id"],
                                    "payload": {
                                        "category": "body-vitals",
                                        "code": "heart-rate",
                                        "display_name": "心率",
                                        "value": 72.0,
                                        "unit": "bpm",
                                        "effective_at": "2026-03-12T08:00:00+08:00",
                                    },
                                }
                            ],
                        },
                    },
                )
            ]
        )

    with override_agent_model(client, function=scripted_model):
        events = stream_chat_message(
            client,
            token=admin["tokens"]["access_token"],
            session_id=session_id,
            member_id=managed_member["id"],
            page_context="member-profile",
            content="帮我分析奶奶今天心率 72 是不是正常",
        )

    suggest_event = next(item for item in events if item["event"] == "tool.suggest")
    assert suggest_event["data"]["tool_name"] == "suggest_record_update"
    action = suggest_event["data"]["draft"]["actions"][0]
    assert action["action"] == "create"
    assert action["resource"] == "observations"
    assert action["target_member_id"] == managed_member["id"]
    assert action["payload"]["code"] == "heart-rate"

    observations_response = client.get(
        f"/api/members/{managed_member['id']}/observations",
        headers=auth_headers(admin["tokens"]["access_token"]),
    )
    assert observations_response.status_code == 200, observations_response.text
    assert observations_response.json() == []


def test_chat_confirm_draft_updates_existing_record(client: TestClient) -> None:
    admin = register_user(client, email="owner@example.com", password="Secret123!", name="管理员")
    managed_member = create_managed_member(client, admin["tokens"]["access_token"], "奶奶")
    observation = create_observation(
        client,
        token=admin["tokens"]["access_token"],
        member_id=managed_member["id"],
        code="heart-rate",
        display_name="心率",
        value=70.0,
        unit="bpm",
    )
    session_id = create_session(
        client,
        token=admin["tokens"]["access_token"],
        member_id=managed_member["id"],
        page_context="member-profile",
    )

    messages_module = importlib.import_module("pydantic_ai.messages")
    ModelResponse = messages_module.ModelResponse
    TextPart = messages_module.TextPart
    ToolCallPart = messages_module.ToolCallPart

    async def scripted_model(messages: list[Any], info: Any) -> Any:
        del info
        latest_part = messages[-1].parts[-1]
        if getattr(latest_part, "part_kind", None) == "tool-return":
            return ModelResponse(parts=[TextPart("已把奶奶的心率更新为 72 bpm。")])
        return ModelResponse(
            parts=[
                ToolCallPart(
                    "draft_health_record_actions",
                    {
                        "summary": "更新心率记录",
                        "actions": [
                            {
                                "action": "update",
                                "resource": "observations",
                                "target_member_id": managed_member["id"],
                                "record_id": observation["id"],
                                "payload": {
                                    "value": 72.0,
                                    "notes": "由 AI 对话修正",
                                },
                            }
                        ],
                    },
                )
            ]
        )

    with override_agent_model(client, function=scripted_model):
        events = stream_chat_message(
            client,
            token=admin["tokens"]["access_token"],
            session_id=session_id,
            member_id=managed_member["id"],
            page_context="member-profile",
            content="把奶奶刚才那条心率从 70 改成 72",
        )
        draft_event = next(item for item in events if item["event"] == "tool.draft")
        tool_call_id = draft_event["data"]["tool_call_id"]

        confirm_response = client.post(
            f"/api/chat/{session_id}/confirm-draft",
            headers=auth_headers(admin["tokens"]["access_token"]),
            json={
                "approvals": {tool_call_id: True},
                "edits": {},
            },
        )

    assert confirm_response.status_code == 200, confirm_response.text
    assert "更新" in confirm_response.json()["assistant_message"]

    observations_response = client.get(
        f"/api/members/{managed_member['id']}/observations",
        headers=auth_headers(admin["tokens"]["access_token"]),
    )
    assert observations_response.status_code == 200, observations_response.text
    updated = next(item for item in observations_response.json() if item["id"] == observation["id"])
    assert updated["value"] == 72.0
    assert updated["notes"] == "由 AI 对话修正"


def test_chat_confirm_draft_deletes_existing_record(client: TestClient) -> None:
    admin = register_user(client, email="owner@example.com", password="Secret123!", name="管理员")
    managed_member = create_managed_member(client, admin["tokens"]["access_token"], "奶奶")
    medication = create_medication(client, token=admin["tokens"]["access_token"], member_id=managed_member["id"])
    session_id = create_session(
        client,
        token=admin["tokens"]["access_token"],
        member_id=managed_member["id"],
        page_context="member-profile",
    )

    messages_module = importlib.import_module("pydantic_ai.messages")
    ModelResponse = messages_module.ModelResponse
    TextPart = messages_module.TextPart
    ToolCallPart = messages_module.ToolCallPart

    async def scripted_model(messages: list[Any], info: Any) -> Any:
        del info
        latest_part = messages[-1].parts[-1]
        if getattr(latest_part, "part_kind", None) == "tool-return":
            return ModelResponse(parts=[TextPart("已删除这条不再使用的用药记录。")])
        return ModelResponse(
            parts=[
                ToolCallPart(
                    "draft_health_record_actions",
                    {
                        "summary": "删除停用药物",
                        "actions": [
                            {
                                "action": "delete",
                                "resource": "medications",
                                "target_member_id": managed_member["id"],
                                "record_id": medication["id"],
                            }
                        ],
                    },
                )
            ]
        )

    with override_agent_model(client, function=scripted_model):
        events = stream_chat_message(
            client,
            token=admin["tokens"]["access_token"],
            session_id=session_id,
            member_id=managed_member["id"],
            page_context="member-profile",
            content="把奶奶已经停掉的缬沙坦从档案里删掉",
        )
        draft_event = next(item for item in events if item["event"] == "tool.draft")
        tool_call_id = draft_event["data"]["tool_call_id"]

        confirm_response = client.post(
            f"/api/chat/{session_id}/confirm-draft",
            headers=auth_headers(admin["tokens"]["access_token"]),
            json={
                "approvals": {tool_call_id: True},
                "edits": {},
            },
        )

    assert confirm_response.status_code == 200, confirm_response.text
    assert "删除" in confirm_response.json()["assistant_message"]

    medications_response = client.get(
        f"/api/members/{managed_member['id']}/medications",
        headers=auth_headers(admin["tokens"]["access_token"]),
    )
    assert medications_response.status_code == 200, medications_response.text
    assert medications_response.json() == []


def test_chat_implicit_action_creates_care_plan(client: TestClient) -> None:
    admin = register_user(client, email="owner@example.com", password="Secret123!", name="管理员")
    managed_member = create_managed_member(client, admin["tokens"]["access_token"], "奶奶")
    session_id = create_session(
        client,
        token=admin["tokens"]["access_token"],
        member_id=managed_member["id"],
        page_context="home",
    )

    messages_module = importlib.import_module("pydantic_ai.messages")
    ModelResponse = messages_module.ModelResponse
    TextPart = messages_module.TextPart
    ToolCallPart = messages_module.ToolCallPart

    async def scripted_model(messages: list[Any], info: Any) -> Any:
        del info
        latest_part = messages[-1].parts[-1]
        if getattr(latest_part, "part_kind", None) == "tool-return":
            return ModelResponse(parts=[TextPart("我已经帮你添加了一条今天下午的跑步提醒。")])
        return ModelResponse(
            parts=[
                ToolCallPart(
                    "create_care_plan",
                    {
                        "title": "下午跑步",
                        "description": "15:00 去公园跑步 30 分钟",
                        "category": "activity-reminder",
                        "scheduled_at": "2026-03-12T15:00:00+08:00",
                    },
                )
            ]
        )

    with override_agent_model(client, function=scripted_model):
        events = stream_chat_message(
            client,
            token=admin["tokens"]["access_token"],
            session_id=session_id,
            member_id=managed_member["id"],
            page_context="home",
            content="下午三点想跑个步",
        )

    tool_result = next(item for item in events if item["event"] == "tool.result")
    assert tool_result["data"]["tool_name"] == "create_care_plan"
    assert "跑步" in tool_result["data"]["content"]

    care_plans_response = client.get(
        f"/api/members/{managed_member['id']}/care-plans",
        headers=auth_headers(admin["tokens"]["access_token"]),
    )
    assert care_plans_response.status_code == 200, care_plans_response.text
    assert any("跑步" in item["title"] for item in care_plans_response.json())


def test_chat_loop_limit_returns_tool_error_when_model_exceeds_request_limit(client: TestClient) -> None:
    admin = register_user(client, email="owner@example.com", password="Secret123!", name="管理员")
    managed_member = create_managed_member(client, admin["tokens"]["access_token"], "奶奶")
    create_observation(client, token=admin["tokens"]["access_token"], member_id=managed_member["id"])
    session_id = create_session(
        client,
        token=admin["tokens"]["access_token"],
        member_id=managed_member["id"],
        page_context="home",
    )

    function_models = importlib.import_module("pydantic_ai.models.function")
    messages_module = importlib.import_module("pydantic_ai.messages")

    ToolCallPart = messages_module.ToolCallPart
    ModelResponse = messages_module.ModelResponse
    DeltaToolCall = function_models.DeltaToolCall

    async def always_call_summary(messages: list[Any], info: Any) -> Any:
        del messages, info
        return ModelResponse(parts=[ToolCallPart("get_member_summary", {})])

    async def stream_always_call_summary(messages: list[Any], info: Any) -> Any:
        response = await always_call_summary(messages, info)
        tool_call = response.parts[0]
        yield {
            0: DeltaToolCall(
                name=tool_call.tool_name,
                json_args=tool_call.args_as_json_str(),
                tool_call_id=tool_call.tool_call_id,
            )
        }

    orchestrator = client.app.state.chat_orchestrator
    original_request_limit = getattr(orchestrator, "_request_limit", None)
    orchestrator._request_limit = 2

    with override_agent_model(
        client,
        function=always_call_summary,
        stream_function=stream_always_call_summary,
    ):
        events = stream_chat_message(
            client,
            token=admin["tokens"]["access_token"],
            session_id=session_id,
            member_id=managed_member["id"],
            page_context="home",
            content="触发一次死循环测试",
        )

    orchestrator._request_limit = original_request_limit

    tool_error = next(item for item in events if item["event"] == "tool.error")
    assert "request_limit" in tool_error["data"]["error"]


def test_transcription_endpoint_returns_text_and_handles_empty_audio(client: TestClient) -> None:
    admin = register_user(client, email="owner@example.com", password="Secret123!", name="管理员")
    transcription_module = importlib.import_module("app.ai.transcription")
    captured: dict[str, Any] = {}

    class StubProvider:
        def transcribe_audio(
            self,
            content: bytes,
            *,
            filename: str | None,
            content_type: str | None,
        ) -> str:
            captured["content"] = content
            captured["filename"] = filename
            captured["content_type"] = content_type
            return "奶奶今天胃口不错"

    client.app.state.settings = replace(
        client.app.state.settings,
        stt_provider="openai",
        stt_model="gpt-4o-mini-transcribe",
    )
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(transcription_module, "get_transcription_provider", lambda settings: StubProvider())

    response = client.post(
        "/api/chat/transcriptions",
        headers=auth_headers(admin["tokens"]["access_token"]),
        files={"file": ("voice.wav", b"\x00\x01binary-audio", "audio/wav")},
    )
    assert response.status_code == 200, response.text
    assert response.json()["text"] == "奶奶今天胃口不错"
    assert captured["content"] == b"\x00\x01binary-audio"
    assert captured["filename"] == "voice.wav"
    assert captured["content_type"] == "audio/wav"

    empty_response = client.post(
        "/api/chat/transcriptions",
        headers=auth_headers(admin["tokens"]["access_token"]),
        files={"file": ("voice.wav", b"", "audio/wav")},
    )
    assert empty_response.status_code == 400
    monkeypatch.undo()


def test_attachment_endpoint_routes_audio_to_transcription(client: TestClient) -> None:
    admin = register_user(client, email="owner@example.com", password="Secret123!", name="管理员")
    chat_module = importlib.import_module("app.api.routes.chat")

    async def stub_transcribe_audio(
        settings: Any,
        *,
        content: bytes,
        filename: str | None = None,
        content_type: str | None = None,
    ) -> str:
        del settings
        assert content == b"voice-bytes"
        assert filename == "voice.wav"
        assert content_type == "audio/wav"
        return "奶奶今天胃口不错"

    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(chat_module, "transcribe_audio", stub_transcribe_audio)

    response = client.post(
        "/api/chat/attachments",
        headers=auth_headers(admin["tokens"]["access_token"]),
        files={"file": ("voice.wav", b"voice-bytes", "audio/wav")},
    )

    assert response.status_code == 200, response.text
    assert response.json() == {
        "attachment": None,
        "suggested_text": "奶奶今天胃口不错",
    }
    monkeypatch.undo()


def test_attachment_endpoint_routes_pdf_to_attachment_parser(client: TestClient) -> None:
    admin = register_user(client, email="owner@example.com", password="Secret123!", name="管理员")
    chat_module = importlib.import_module("app.api.routes.chat")

    async def stub_handle_chat_attachment_upload(
        settings: Any,
        *,
        content: bytes,
        filename: str | None = None,
        content_type: str | None = None,
    ) -> dict[str, Any]:
        del settings
        assert content == b"%PDF-1.7"
        assert filename == "report.pdf"
        assert content_type == "application/pdf"
        return {
            "attachment": {
                "filename": "report.pdf",
                "media_type": "application/pdf",
                "source_type": "docling",
                "ocr_used": False,
                "excerpt": "收缩压 126mmHg，早餐后服药。",
                "markdown_excerpt": "## 关键结论\n收缩压 126mmHg，早餐后服药。",
            },
            "suggested_text": "我上传了附件《report.pdf》，请结合其中内容继续分析。",
        }

    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(
        chat_module,
        "handle_chat_attachment_upload",
        stub_handle_chat_attachment_upload,
        raising=False,
    )

    response = client.post(
        "/api/chat/attachments",
        headers=auth_headers(admin["tokens"]["access_token"]),
        files={"file": ("report.pdf", b"%PDF-1.7", "application/pdf")},
    )

    assert response.status_code == 200, response.text
    assert response.json()["attachment"]["source_type"] == "docling"
    assert "report.pdf" in response.json()["suggested_text"]
    monkeypatch.undo()


def test_attachment_endpoint_rejects_unsupported_files(client: TestClient) -> None:
    admin = register_user(client, email="owner@example.com", password="Secret123!", name="管理员")

    response = client.post(
        "/api/chat/attachments",
        headers=auth_headers(admin["tokens"]["access_token"]),
        files={"file": ("notes.txt", b"plain text", "text/plain")},
    )

    assert response.status_code == 415


def test_chat_message_can_include_attachment_context(client: TestClient) -> None:
    admin = register_user(client, email="owner@example.com", password="Secret123!", name="管理员")
    managed_member = create_managed_member(client, admin["tokens"]["access_token"], "奶奶")
    session_id = create_session(
        client,
        token=admin["tokens"]["access_token"],
        member_id=managed_member["id"],
        page_context="home",
    )

    messages_module = importlib.import_module("pydantic_ai.messages")
    ModelResponse = messages_module.ModelResponse
    TextPart = messages_module.TextPart

    async def scripted_model(messages: list[Any], info: Any) -> Any:
        del info
        if any("收缩压 126mmHg，早餐后服药。" in str(message) for message in messages):
            return ModelResponse(parts=[TextPart("已收到附件上下文")])
        return ModelResponse(parts=[TextPart("缺少附件上下文")])

    with override_agent_model(client, function=scripted_model):
        events = stream_chat_message(
            client,
            token=admin["tokens"]["access_token"],
            session_id=session_id,
            member_id=managed_member["id"],
            page_context="home",
            content="请结合附件总结一下",
            attachments=[
                {
                    "filename": "report.pdf",
                    "media_type": "application/pdf",
                    "source_type": "docling",
                    "ocr_used": False,
                    "excerpt": "收缩压 126mmHg，早餐后服药。",
                    "markdown_excerpt": "## 关键结论\n收缩压 126mmHg，早餐后服药。",
                }
            ],
        )

    assert events[-1]["event"] == "message.completed"
    assert events[-1]["data"]["content"] == "已收到附件上下文"


def test_admin_ai_settings_apply_to_following_transcription_requests(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    admin = register_user(client, email="owner@example.com", password="Secret123!", name="管理员")
    transcription_module = importlib.import_module("app.ai.transcription")
    captured: dict[str, Any] = {}

    class StubProvider:
        def transcribe_audio(
            self,
            content: bytes,
            *,
            filename: str | None,
            content_type: str | None,
        ) -> str:
            captured["content"] = content
            captured["filename"] = filename
            captured["content_type"] = content_type
            return "local whisper text"

    def capture_provider(settings: Any) -> StubProvider:
        captured["provider"] = settings.stt_provider
        captured["ai_base_url"] = settings.ai_base_url
        captured["ai_api_key"] = settings.ai_api_key
        captured["ai_model"] = settings.ai_model
        captured["stt_language"] = settings.stt_language
        captured["stt_timeout_seconds"] = settings.stt_timeout_seconds
        captured["local_whisper_model"] = settings.local_whisper_model
        captured["local_whisper_device"] = settings.local_whisper_device
        captured["local_whisper_compute_type"] = settings.local_whisper_compute_type
        captured["local_whisper_download_root"] = settings.local_whisper_download_root
        return StubProvider()

    monkeypatch.setattr(transcription_module, "get_transcription_provider", capture_provider)

    update_response = client.put(
        "/api/admin/settings",
        headers=auth_headers(admin["tokens"]["access_token"]),
        json={
            "transcription": {
                "provider": "local_whisper",
                "language": "en",
                "timeout": 9.5,
                "local_whisper_model": "whisper-small",
                "local_whisper_device": "cpu",
                "local_whisper_compute_type": "int8",
                "local_whisper_download_root": "/tmp/whisper-cache",
            },
            "chat_model": {
                "base_url": "https://override.invalid/v1",
                "api_key": "override-key",
                "model": "override-model",
            },
        },
    )
    assert update_response.status_code == 200, update_response.text

    response = client.post(
        "/api/chat/transcriptions",
        headers=auth_headers(admin["tokens"]["access_token"]),
        files={"file": ("voice.wav", b"audio-bytes", "audio/wav")},
    )

    assert response.status_code == 200, response.text
    assert response.json() == {"text": "local whisper text"}
    assert captured == {
        "provider": "local_whisper",
        "ai_base_url": "https://override.invalid/v1",
        "ai_api_key": "override-key",
        "ai_model": "override-model",
        "stt_language": "en",
        "stt_timeout_seconds": 9.5,
        "local_whisper_model": "whisper-small",
        "local_whisper_device": "cpu",
        "local_whisper_compute_type": "int8",
        "local_whisper_download_root": "/tmp/whisper-cache",
        "content": b"audio-bytes",
        "filename": "voice.wav",
        "content_type": "audio/wav",
    }


def test_openai_transcription_provider_posts_multipart_request() -> None:
    transcription_module = importlib.import_module("app.ai.transcription")
    captured: dict[str, Any] = {}

    class DummyResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, str]:
            return {"text": "奶奶今天胃口不错"}

    class DummyClient:
        def __init__(self, *, timeout: float) -> None:
            captured["timeout"] = timeout

        def __enter__(self) -> DummyClient:
            return self

        def __exit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
            del exc_type, exc, tb

        def post(
            self,
            url: str,
            *,
            headers: dict[str, str],
            data: dict[str, str],
            files: dict[str, tuple[str, bytes, str]],
        ) -> DummyResponse:
            captured["url"] = url
            captured["headers"] = headers
            captured["data"] = data
            captured["files"] = files
            return DummyResponse()

    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(transcription_module.httpx, "Client", DummyClient)

    provider = transcription_module.OpenAITranscriptionProvider(
        base_url="https://example.invalid/v1",
        api_key="stt-secret",
        model="gpt-4o-mini-transcribe",
        language="zh",
        prompt="常见药名：阿司匹林",
        timeout_seconds=12.5,
    )

    result = provider.transcribe_audio(
        b"\x00\x01binary-audio",
        filename="voice.wav",
        content_type="audio/wav",
    )

    assert result == "奶奶今天胃口不错"
    assert captured["url"] == "https://example.invalid/v1/audio/transcriptions"
    assert captured["headers"]["Authorization"] == "Bearer stt-secret"
    assert captured["data"]["model"] == "gpt-4o-mini-transcribe"
    assert captured["data"]["language"] == "zh"
    assert captured["data"]["prompt"] == "常见药名：阿司匹林"
    assert captured["files"]["file"] == ("voice.wav", b"\x00\x01binary-audio", "audio/wav")
    assert captured["timeout"] == 12.5
    monkeypatch.undo()


def test_local_whisper_transcription_provider_uses_local_model(tmp_path: Any) -> None:
    transcription_module = importlib.import_module("app.ai.transcription")
    captured: dict[str, Any] = {}

    class FakeSegment:
        def __init__(self, text: str) -> None:
            self.text = text

    class FakeWhisperModel:
        def transcribe(
            self,
            audio_path: str,
            *,
            language: str | None = None,
            initial_prompt: str | None = None,
        ) -> tuple[list[FakeSegment], dict[str, str]]:
            captured["audio_path"] = audio_path
            captured["language"] = language
            captured["initial_prompt"] = initial_prompt
            return [FakeSegment("奶奶今天"), FakeSegment("胃口不错")], {"language": "zh"}

    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(
        transcription_module,
        "_load_local_whisper_model",
        lambda **_: FakeWhisperModel(),
    )

    provider = transcription_module.LocalWhisperTranscriptionProvider(
        model_name="whisper-large-v3-turbo",
        device="cpu",
        compute_type="int8",
        prompt="常见药名：阿司匹林",
        language="zh",
        download_root=str(tmp_path),
    )

    result = provider.transcribe_audio(
        b"\x00\x01binary-audio",
        filename="voice.wav",
        content_type="audio/wav",
    )

    assert result == "奶奶今天胃口不错"
    assert captured["audio_path"].endswith(".wav")
    assert captured["language"] == "zh"
    assert captured["initial_prompt"] == "常见药名：阿司匹林"
    monkeypatch.undo()


def test_scheduler_registers_builtin_daily_refresh_jobs(custom_schedule_client: TestClient) -> None:
    scheduler = custom_schedule_client.app.state.scheduler

    summary_job = scheduler.get_job("builtin.refresh_health_summaries")
    care_plan_job = scheduler.get_job("builtin.refresh_daily_care_plans")

    assert summary_job is not None
    assert care_plan_job is not None
    assert "hour='4'" in str(summary_job.trigger)
    assert "minute='15'" in str(summary_job.trigger)
    assert "hour='6'" in str(care_plan_job.trigger)
    assert "minute='45'" in str(care_plan_job.trigger)


def test_scheduler_refreshes_ai_generated_content_and_preserves_manual_care_plans(client: TestClient) -> None:
    admin = register_user(client, email="owner@example.com", password="Secret123!", name="管理员")
    managed_member = create_managed_member(client, admin["tokens"]["access_token"], "奶奶")
    headers = auth_headers(admin["tokens"]["access_token"])
    create_observation(client, token=admin["tokens"]["access_token"], member_id=managed_member["id"])
    create_sleep_record(client, token=admin["tokens"]["access_token"], member_id=managed_member["id"])
    create_workout_record(client, token=admin["tokens"]["access_token"], member_id=managed_member["id"])
    create_care_plan(client, token=admin["tokens"]["access_token"], member_id=managed_member["id"], title="早餐后服药")

    old_summary_response = client.post(
        f"/api/members/{managed_member['id']}/health-summaries",
        headers=headers,
        json={
            "category": "chronic-vitals",
            "label": "旧摘要",
            "value": "旧的慢病说明",
            "status": "warning",
            "generated_at": "2026-03-12T08:00:00+08:00",
        },
    )
    assert old_summary_response.status_code == 201, old_summary_response.text

    old_ai_care_plan = client.post(
        f"/api/members/{managed_member['id']}/care-plans",
        headers=headers,
        json={
            "category": "daily-tip",
            "title": "旧的 AI 提醒",
            "description": "已经过期",
            "status": "active",
            "scheduled_at": shanghai_today(7, 30),
            "generated_by": "ai",
        },
    )
    assert old_ai_care_plan.status_code == 201, old_ai_care_plan.text

    scheduler = client.app.state.scheduler

    messages_module = importlib.import_module("pydantic_ai.messages")
    ModelResponse = messages_module.ModelResponse
    ToolCallPart = messages_module.ToolCallPart

    async def summary_model(messages: list[Any], info: Any) -> Any:
        del messages
        output_tool = info.output_tools[0]
        return ModelResponse(
            parts=[
                ToolCallPart(
                    output_tool.name,
                    {
                        "summaries": [
                            {
                                "category": "血压趋势",
                                "label": "血压波动",
                                "value": "血压整体平稳，继续按计划监测。",
                                "status": "good",
                            },
                            {
                                "category": "睡眠恢复",
                                "label": "睡眠节律",
                                "value": "睡眠与运动节奏稳定，可以继续保持。",
                                "status": "good",
                            },
                            {
                                "category": "情绪支持",
                                "label": "情绪提醒",
                                "value": "今天更适合轻量安排，避免额外疲劳。",
                                "status": "warning",
                            },
                            {
                                "category": "用药依从",
                                "label": "服药观察",
                                "value": "晚间药物提醒需要继续保持。",
                                "status": "alert",
                            },
                        ]
                    },
                )
            ]
        )

    async def care_plan_model(messages: list[Any], info: Any) -> Any:
        del messages
        output_tool = info.output_tools[0]
        return ModelResponse(
            parts=[
                ToolCallPart(
                    output_tool.name,
                    {
                        "care_plans": [
                            {
                                "category": "activity-reminder",
                                "icon_key": "exercise",
                                "time_slot": "午后",
                                "assignee_member_id": managed_member["id"],
                                "title": "午后散步 20 分钟",
                                "description": "午饭后安排一段轻量散步，帮助维持今天的活动量。",
                                "notes": "以舒缓步行为主。",
                            },
                            {
                                "category": "medication-reminder",
                                "icon_key": "medication",
                                "time_slot": "晚间",
                                "assignee_member_id": managed_member["id"],
                                "title": "晚间按时服药",
                                "description": "睡前按既定计划服用降压药。",
                                "notes": "服药后记录体感。",
                            },
                        ]
                    },
                )
            ]
        )

    with override_daily_generation_models(
        client,
        summary_function=summary_model,
        care_plan_function=care_plan_model,
    ):
        summary_result = scheduler.refresh_health_summaries()
        care_plan_result = scheduler.refresh_daily_care_plans()

    assert managed_member["id"] in summary_result["member_ids"]
    assert managed_member["id"] in care_plan_result["member_ids"]

    summaries_response = client.get(
        f"/api/members/{managed_member['id']}/health-summaries",
        headers=headers,
    )
    assert summaries_response.status_code == 200, summaries_response.text
    summaries = summaries_response.json()
    assert {item["category"] for item in summaries} == {"血压趋势", "睡眠恢复", "情绪支持", "用药依从"}
    assert {item["value"] for item in summaries} == {
        "血压整体平稳，继续按计划监测。",
        "睡眠与运动节奏稳定，可以继续保持。",
        "今天更适合轻量安排，避免额外疲劳。",
        "晚间药物提醒需要继续保持。",
    }

    care_plans_response = client.get(
        f"/api/members/{managed_member['id']}/care-plans",
        headers=headers,
    )
    assert care_plans_response.status_code == 200, care_plans_response.text
    care_plans = care_plans_response.json()
    titles = {item["title"] for item in care_plans}
    assert "早餐后服药" in titles
    assert "旧的 AI 提醒" not in titles
    assert "午后散步 20 分钟" in titles
    assert "晚间按时服药" in titles

    generated_today = [item for item in care_plans if item["generated_by"] == "ai" and item["status"] == "active"]
    assert len(generated_today) == 2
    generated_by_title = {item["title"]: item for item in generated_today}
    assert generated_by_title["午后散步 20 分钟"]["scheduled_at"].endswith("14:00:00+08:00")
    assert generated_by_title["午后散步 20 分钟"]["time_slot"] == "午后"
    assert generated_by_title["午后散步 20 分钟"]["icon_key"] == "exercise"
    assert generated_by_title["午后散步 20 分钟"]["assignee_member_id"] == managed_member["id"]
    assert generated_by_title["午后散步 20 分钟"]["notes"] == "以舒缓步行为主。"
    assert generated_by_title["晚间按时服药"]["scheduled_at"].endswith("20:00:00+08:00")
    assert generated_by_title["晚间按时服药"]["time_slot"] == "晚间"
    assert generated_by_title["晚间按时服药"]["icon_key"] == "medication"
    assert generated_by_title["晚间按时服药"]["notes"] == "服药后记录体感。"


def test_scheduler_skips_unconfigured_ai_and_keeps_existing_daily_content(unconfigured_client: TestClient) -> None:
    admin = register_user(unconfigured_client, email="owner@example.com", password="Secret123!", name="管理员")
    managed_member = create_managed_member(unconfigured_client, admin["tokens"]["access_token"], "奶奶")
    headers = auth_headers(admin["tokens"]["access_token"])

    old_summary_response = unconfigured_client.post(
        f"/api/members/{managed_member['id']}/health-summaries",
        headers=headers,
        json={
            "category": "chronic-vitals",
            "label": "旧摘要",
            "value": "保持原样",
            "status": "warning",
            "generated_at": "2026-03-12T08:00:00+08:00",
        },
    )
    assert old_summary_response.status_code == 201, old_summary_response.text

    old_ai_care_plan = unconfigured_client.post(
        f"/api/members/{managed_member['id']}/care-plans",
        headers=headers,
        json={
            "category": "daily-tip",
            "title": "旧的 AI 提醒",
            "description": "仍应保留",
            "status": "active",
            "scheduled_at": shanghai_today(9, 0),
            "generated_by": "ai",
        },
    )
    assert old_ai_care_plan.status_code == 201, old_ai_care_plan.text

    scheduler = unconfigured_client.app.state.scheduler

    summary_result = scheduler.refresh_health_summaries()
    care_plan_result = scheduler.refresh_daily_care_plans()

    assert managed_member["id"] in summary_result["failed_member_ids"]
    assert managed_member["id"] in care_plan_result["failed_member_ids"]
    assert managed_member["id"] not in summary_result["member_ids"]
    assert managed_member["id"] not in care_plan_result["member_ids"]

    summaries_response = unconfigured_client.get(
        f"/api/members/{managed_member['id']}/health-summaries",
        headers=headers,
    )
    assert summaries_response.status_code == 200, summaries_response.text
    assert [item["value"] for item in summaries_response.json()] == ["保持原样"]

    care_plans_response = unconfigured_client.get(
        f"/api/members/{managed_member['id']}/care-plans",
        headers=headers,
    )
    assert care_plans_response.status_code == 200, care_plans_response.text
    assert [item["title"] for item in care_plans_response.json()] == ["旧的 AI 提醒"]


def test_scheduler_continues_refresh_when_one_member_generation_fails(client: TestClient) -> None:
    admin = register_user(client, email="owner@example.com", password="Secret123!", name="管理员")
    good_member = create_managed_member(client, admin["tokens"]["access_token"], "奶奶")
    bad_member = create_managed_member(client, admin["tokens"]["access_token"], "外婆")
    headers = auth_headers(admin["tokens"]["access_token"])
    create_observation(client, token=admin["tokens"]["access_token"], member_id=good_member["id"])
    create_observation(client, token=admin["tokens"]["access_token"], member_id=bad_member["id"])

    old_summary_response = client.post(
        f"/api/members/{bad_member['id']}/health-summaries",
        headers=headers,
        json={
            "category": "chronic-vitals",
            "label": "旧摘要",
            "value": "不要被覆盖",
            "status": "warning",
            "generated_at": "2026-03-12T08:00:00+08:00",
        },
    )
    assert old_summary_response.status_code == 201, old_summary_response.text

    messages_module = importlib.import_module("pydantic_ai.messages")
    ModelResponse = messages_module.ModelResponse
    ToolCallPart = messages_module.ToolCallPart

    async def summary_model(messages: list[Any], info: Any) -> Any:
        output_tool = info.output_tools[0]
        if any("外婆" in str(message) for message in messages):
            return ModelResponse(
                parts=[
                    ToolCallPart(
                        output_tool.name,
                        {
                            "summaries": [
                                {
                                    "category": "异常信号",
                                    "label": "无效摘要",
                                    "value": "这条结果应触发校验失败。",
                                    "status": "critical",
                                }
                            ]
                        },
                    )
                ]
            )

        return ModelResponse(
            parts=[
                ToolCallPart(
                    output_tool.name,
                    {
                        "summaries": [
                            {
                                "category": "血压趋势",
                                "label": "慢病管理",
                                "value": "监测计划正常。",
                                "status": "good",
                            },
                            {
                                "category": "生活节律",
                                "label": "生活习惯",
                                "value": "建议保持规律作息。",
                                "status": "warning",
                            },
                            {
                                "category": "恢复状态",
                                "label": "生理指标",
                                "value": "当前指标稳定。",
                                "status": "good",
                            },
                        ]
                    },
                )
            ]
        )

    with override_daily_generation_models(client, summary_function=summary_model):
        summary_result = client.app.state.scheduler.refresh_health_summaries()

    assert good_member["id"] in summary_result["member_ids"]
    assert bad_member["id"] in summary_result["failed_member_ids"]

    good_summaries = client.get(
        f"/api/members/{good_member['id']}/health-summaries",
        headers=headers,
    )
    assert good_summaries.status_code == 200, good_summaries.text
    assert {item["value"] for item in good_summaries.json()} == {
        "监测计划正常。",
        "建议保持规律作息。",
        "当前指标稳定。",
    }

    bad_summaries = client.get(
        f"/api/members/{bad_member['id']}/health-summaries",
        headers=headers,
    )
    assert bad_summaries.status_code == 200, bad_summaries.text
    assert [item["value"] for item in bad_summaries.json()] == ["不要被覆盖"]


def test_manual_member_health_summary_refresh_endpoint_generates_latest_summary(client: TestClient) -> None:
    admin = register_user(client, email="owner@example.com", password="Secret123!", name="管理员")
    managed_member = create_managed_member(client, admin["tokens"]["access_token"], "奶奶")
    headers = auth_headers(admin["tokens"]["access_token"])
    create_observation(client, token=admin["tokens"]["access_token"], member_id=managed_member["id"])

    old_summary_response = client.post(
        f"/api/members/{managed_member['id']}/health-summaries",
        headers=headers,
        json={
            "category": "旧主题",
            "label": "旧摘要",
            "value": "应被新的 AI 摘要替换。",
            "status": "warning",
            "generated_at": "2026-03-12T08:00:00+08:00",
        },
    )
    assert old_summary_response.status_code == 201, old_summary_response.text

    messages_module = importlib.import_module("pydantic_ai.messages")
    ModelResponse = messages_module.ModelResponse
    ToolCallPart = messages_module.ToolCallPart

    async def summary_model(messages: list[Any], info: Any) -> Any:
        del messages
        output_tool = info.output_tools[0]
        return ModelResponse(
            parts=[
                ToolCallPart(
                    output_tool.name,
                    {
                        "summaries": [
                            {
                                "category": "血压趋势",
                                "label": "血压控制",
                                "value": "今天收缩压更稳定，继续保持监测。",
                                "status": "good",
                            },
                            {
                                "category": "睡眠恢复",
                                "label": "睡眠节律",
                                "value": "昨晚睡眠完整，白天可以安排轻量活动。",
                                "status": "warning",
                            },
                            {
                                "category": "活动表现",
                                "label": "活动恢复",
                                "value": "上午活动量适中，可以继续保持。",
                                "status": "good",
                            },
                            {
                                "category": "代谢监测",
                                "label": "血糖波动",
                                "value": "空腹血糖平稳，继续关注饮食节奏。",
                                "status": "good",
                            },
                            {
                                "category": "额外提示",
                                "label": "应被截断",
                                "value": "这是第五条，不应写入数据库。",
                                "status": "warning",
                            },
                        ]
                    },
                )
            ]
        )

    with override_daily_generation_models(client, summary_function=summary_model):
        refresh_response = client.post(
            f"/api/members/{managed_member['id']}/health-summaries/refresh",
            headers=headers,
        )

    assert refresh_response.status_code == 200, refresh_response.text
    payload = refresh_response.json()
    assert payload["member_ids"] == [managed_member["id"]]
    assert payload["failed_member_ids"] == []

    summaries_response = client.get(
        f"/api/members/{managed_member['id']}/health-summaries",
        headers=headers,
    )
    assert summaries_response.status_code == 200, summaries_response.text
    summaries = summaries_response.json()
    assert [item["label"] for item in summaries] == [
        "血压控制",
        "睡眠节律",
        "活动恢复",
        "血糖波动",
    ]
    assert {item["value"] for item in summaries} == {
        "今天收缩压更稳定，继续保持监测。",
        "昨晚睡眠完整，白天可以安排轻量活动。",
        "上午活动量适中，可以继续保持。",
        "空腹血糖平稳，继续关注饮食节奏。",
    }
    assert all(item["label"] != "应被截断" for item in summaries)

    dashboard_response = client.get("/api/dashboard", headers=headers)
    assert dashboard_response.status_code == 200, dashboard_response.text
    dashboard_payload = dashboard_response.json()
    member_summary = next(item for item in dashboard_payload["members"] if item["member"]["id"] == managed_member["id"])
    assert [item["label"] for item in member_summary["health_summaries"]] == [
        "血压控制",
        "睡眠节律",
        "活动恢复",
        "血糖波动",
    ]


def test_manual_dashboard_care_plan_refresh_endpoint_generates_latest_reminders(client: TestClient) -> None:
    admin = register_user(client, email="owner@example.com", password="Secret123!", name="管理员")
    managed_member = create_managed_member(client, admin["tokens"]["access_token"], "奶奶")
    headers = auth_headers(admin["tokens"]["access_token"])
    create_observation(client, token=admin["tokens"]["access_token"], member_id=managed_member["id"])
    manual_care_plan = client.post(
        f"/api/members/{managed_member['id']}/care-plans",
        headers=headers,
        json={
            "category": "medication-reminder",
            "title": "早餐后服药",
            "description": "08:30 服用降压药",
            "status": "active",
            "scheduled_at": shanghai_today(8, 30),
            "generated_by": "manual",
        },
    )
    assert manual_care_plan.status_code == 201, manual_care_plan.text

    old_ai_care_plan = client.post(
        f"/api/members/{managed_member['id']}/care-plans",
        headers=headers,
        json={
            "category": "daily-tip",
            "title": "旧的 AI 提醒",
            "description": "应被新的 AI 提醒替换。",
            "status": "active",
            "scheduled_at": shanghai_today(7, 0),
            "generated_by": "ai",
        },
    )
    assert old_ai_care_plan.status_code == 201, old_ai_care_plan.text

    messages_module = importlib.import_module("pydantic_ai.messages")
    ModelResponse = messages_module.ModelResponse
    ToolCallPart = messages_module.ToolCallPart

    async def care_plan_model(messages: list[Any], info: Any) -> Any:
        del messages
        output_tool = info.output_tools[0]
        return ModelResponse(
            parts=[
                ToolCallPart(
                    output_tool.name,
                    {
                        "care_plans": [
                            {
                                "category": "activity-reminder",
                                "icon_key": "exercise",
                                "time_slot": "午后",
                                "assignee_member_id": managed_member["id"],
                                "title": "午后散步 20 分钟",
                                "description": "午饭后安排一段轻量散步。",
                                "notes": "以舒缓步行为主。",
                            },
                            {
                                "category": "medication-reminder",
                                "icon_key": "medication",
                                "time_slot": "晚间",
                                "assignee_member_id": managed_member["id"],
                                "title": "晚间按时服药",
                                "description": "睡前按既定计划服用降压药。",
                                "notes": "服药后记录体感。",
                            },
                        ]
                    },
                )
            ]
        )

    with override_daily_generation_models(client, care_plan_function=care_plan_model):
        refresh_response = client.post("/api/dashboard/today-reminders/refresh", headers=headers)

    assert refresh_response.status_code == 200, refresh_response.text
    payload = refresh_response.json()
    assert managed_member["id"] in payload["member_ids"]
    assert payload["failed_member_ids"] == []

    care_plans_response = client.get(
        f"/api/members/{managed_member['id']}/care-plans",
        headers=headers,
    )
    assert care_plans_response.status_code == 200, care_plans_response.text
    care_plans = care_plans_response.json()
    titles = {item["title"] for item in care_plans}
    assert "早餐后服药" in titles
    assert "旧的 AI 提醒" not in titles
    assert "午后散步 20 分钟" in titles
    assert "晚间按时服药" in titles

    dashboard_response = client.get("/api/dashboard", headers=headers)
    assert dashboard_response.status_code == 200, dashboard_response.text
    dashboard_payload = dashboard_response.json()
    assert {item["title"] for item in dashboard_payload["today_reminders"]} == {
        "早餐后服药",
        "午后散步 20 分钟",
        "晚间按时服药",
    }
    assert dashboard_payload["today_reminders_refreshed_at"] is not None
