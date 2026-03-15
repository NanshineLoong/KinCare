from __future__ import annotations

from contextlib import ExitStack
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


def create_session(client: TestClient, *, token: str, member_id: str, page_context: str) -> str:
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
) -> list[dict[str, Any]]:
    with client.stream(
        "POST",
        f"/api/chat/sessions/{session_id}/messages",
        headers=auth_headers(token),
        json={
            "content": content,
            "member_id": member_id,
            "page_context": page_context,
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
                    "draft_observations",
                    {
                        "observations": [
                            {
                                "category": "body-vitals",
                                "code": "heart-rate",
                                "display_name": "心率",
                                "value": 72.0,
                                "unit": "bpm",
                                "effective_at": "2026-03-12T08:00:00+08:00",
                            }
                        ]
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
    assert draft_event["data"]["tool_name"] == "draft_observations"
    assert draft_event["data"]["requires_confirmation"] is True
    assert draft_event["data"]["draft"]["observations"][0]["code"] == "heart-rate"
    assert "care_plans" not in draft_event["data"]["draft"]

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
                    "draft_observations",
                    {
                        "observations": [
                            {
                                "category": "body-vitals",
                                "code": "heart-rate",
                                "display_name": "心率",
                                "value": 72.0,
                                "unit": "bpm",
                                "effective_at": "2026-03-12T08:00:00+08:00",
                            }
                        ]
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
                            "observations": [
                                {
                                    "category": "body-vitals",
                                    "code": "heart-rate",
                                    "display_name": "心率",
                                    "value": 72.0,
                                    "unit": "bpm",
                                    "effective_at": "2026-03-12T08:00:00+08:00",
                                }
                            ],
                            "conditions": [],
                            "medications": [],
                            "encounters": [],
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
    assert suggest_event["data"]["draft"]["observations"][0]["code"] == "heart-rate"

    observations_response = client.get(
        f"/api/members/{managed_member['id']}/observations",
        headers=auth_headers(admin["tokens"]["access_token"]),
    )
    assert observations_response.status_code == 200, observations_response.text
    assert observations_response.json() == []


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

    response = client.post(
        "/api/chat/transcriptions",
        headers=auth_headers(admin["tokens"]["access_token"]),
        files={"file": ("voice.wav", "奶奶今天胃口不错".encode("utf-8"), "audio/wav")},
    )
    assert response.status_code == 200, response.text
    assert response.json()["text"] == "奶奶今天胃口不错"

    empty_response = client.post(
        "/api/chat/transcriptions",
        headers=auth_headers(admin["tokens"]["access_token"]),
        files={"file": ("voice.wav", b"", "audio/wav")},
    )
    assert empty_response.status_code == 400


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
                                "category": "chronic-vitals",
                                "label": "慢病管理",
                                "value": "血压整体平稳，继续按计划监测。",
                                "status": "good",
                            },
                            {
                                "category": "lifestyle",
                                "label": "生活习惯",
                                "value": "睡眠与运动节奏稳定，可以继续保持。",
                                "status": "good",
                            },
                            {
                                "category": "body-vitals",
                                "label": "生理指标",
                                "value": "心率与体征暂无明显异常。",
                                "status": "neutral",
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
                        "care_plan": {
                            "category": "activity-reminder",
                            "title": "午后散步 20 分钟",
                            "description": "午饭后安排一段轻量散步，帮助维持今天的活动量。",
                            "time_slot": "afternoon",
                        }
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
    assert {item["category"] for item in summaries} == {"chronic-vitals", "lifestyle", "body-vitals"}
    assert {item["value"] for item in summaries} == {
        "血压整体平稳，继续按计划监测。",
        "睡眠与运动节奏稳定，可以继续保持。",
        "心率与体征暂无明显异常。",
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

    generated_today = [item for item in care_plans if item["generated_by"] == "ai" and item["status"] == "active"]
    assert len(generated_today) == 1
    assert generated_today[0]["scheduled_at"].endswith("14:00:00+08:00")


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
                                    "category": "unsupported",
                                    "label": "无效摘要",
                                    "value": "这条结果应触发校验失败。",
                                    "status": "warning",
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
                                "category": "chronic-vitals",
                                "label": "慢病管理",
                                "value": "监测计划正常。",
                                "status": "good",
                            },
                            {
                                "category": "lifestyle",
                                "label": "生活习惯",
                                "value": "建议保持规律作息。",
                                "status": "neutral",
                            },
                            {
                                "category": "body-vitals",
                                "label": "生理指标",
                                "value": "当前指标稳定。",
                                "status": "neutral",
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
