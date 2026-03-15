from __future__ import annotations

import importlib
import json
import sys
from typing import Any

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
    monkeypatch.setenv("HOMEVITAL_UPLOAD_DIR", str(tmp_path / "uploads"))
    monkeypatch.setenv("HOMEVITAL_AI_PROVIDER", "stub")
    monkeypatch.setenv("HOMEVITAL_AI_MODEL", "stub-homevital")
    monkeypatch.setenv("HOMEVITAL_SCHEDULER_ENABLED", "1")

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


def test_chat_explicit_extract_emits_draft_event_without_writing_observation(client: TestClient) -> None:
    admin = register_user(client, email="owner@example.com", password="Secret123!", name="管理员")
    managed_member = create_managed_member(client, admin["tokens"]["access_token"], "奶奶")
    session_id = create_session(
        client,
        token=admin["tokens"]["access_token"],
        member_id=managed_member["id"],
        page_context="member-profile",
    )

    events = stream_chat_message(
        client,
        token=admin["tokens"]["access_token"],
        session_id=session_id,
        member_id=managed_member["id"],
        page_context="member-profile",
        content="帮我提取奶奶今天心率 72 到档案里",
    )

    assert events[0]["event"] == "session.started"
    draft_event = next(item for item in events if item["event"] == "tool.draft")
    assert draft_event["data"]["tool_name"] == "draft_observations"
    assert draft_event["data"]["requires_confirmation"] is True
    assert draft_event["data"]["tool_call_id"]
    assert draft_event["data"]["draft"]["observations"][0]["code"] == "heart-rate"

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
        "care_plans": 0,
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

    events = stream_chat_message(
        client,
        token=admin["tokens"]["access_token"],
        session_id=session_id,
        member_id=managed_member["id"],
        page_context="member-profile",
        content="帮我分析奶奶今天心率 72 是不是正常",
    )

    event_names = [item["event"] for item in events]
    assert "tool.suggest" in event_names
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

    agent_module = importlib.import_module("app.ai.agent")
    function_models = importlib.import_module("pydantic_ai.models.function")
    messages_module = importlib.import_module("pydantic_ai.messages")

    ToolCallPart = messages_module.ToolCallPart
    ModelResponse = messages_module.ModelResponse
    FunctionModel = function_models.FunctionModel

    async def always_call_summary(messages: list[Any], info: Any) -> Any:
        del messages
        return ModelResponse(parts=[ToolCallPart("get_member_summary", {})])

    async def stream_always_call_summary(messages: list[Any], info: Any) -> Any:
        response = await always_call_summary(messages, info)
        tool_call = response.parts[0]
        yield {
            0: function_models.DeltaToolCall(
                name=tool_call.tool_name,
                json_args=tool_call.args_as_json_str(),
                tool_call_id=tool_call.tool_call_id,
            )
        }

    orchestrator = client.app.state.chat_orchestrator
    original_request_limit = getattr(orchestrator, "_request_limit", None)
    orchestrator._request_limit = 2

    with orchestrator._agent.override(
        model=FunctionModel(function=always_call_summary, stream_function=stream_always_call_summary)
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


def test_scheduler_service_creates_executes_and_disables_task(client: TestClient) -> None:
    admin = register_user(client, email="owner@example.com", password="Secret123!", name="管理员")
    managed_member = create_managed_member(client, admin["tokens"]["access_token"], "奶奶")

    _clear_app_modules()
    scheduler_module = importlib.import_module("app.ai.scheduler")
    dependencies = importlib.import_module("app.core.dependencies")

    current_user = dependencies.CurrentUser(
        id=admin["user"]["id"],
        family_space_id=admin["user"]["family_space_id"],
        email=admin["user"]["email"],
        role=admin["user"]["role"],
        member_id=admin["member"]["id"],
    )
    database = client.app.state.database

    created_task = scheduler_module.create_scheduled_task(
        database=database,
        current_user=current_user,
        member_id=managed_member["id"],
        payload={
            "task_type": "daily-check",
            "prompt": "每天 20:15 提醒奶奶饭后散步 20 分钟",
            "schedule_type": "daily",
            "schedule_config": {"hour": 20, "minute": 15},
        },
    )

    assert created_task["enabled"] is True
    assert created_task["next_run_at"] is not None

    run_result = scheduler_module.run_scheduled_task_now(client.app.state.scheduler, created_task["id"])
    assert run_result["care_plan"]["title"] == "每天健康提醒"
    assert run_result["care_plan"]["generated_by"] == "ai"

    disabled_task = scheduler_module.disable_scheduled_task(
        database=database,
        current_user=current_user,
        task_id=created_task["id"],
    )
    assert disabled_task["enabled"] is False
    assert client.app.state.scheduler.get_job(created_task["id"]) is None

    care_plans_response = client.get(
        f"/api/members/{managed_member['id']}/care-plans",
        headers=auth_headers(admin["tokens"]["access_token"]),
    )
    assert care_plans_response.status_code == 200, care_plans_response.text
    assert any(item["title"] == "每天健康提醒" for item in care_plans_response.json())
