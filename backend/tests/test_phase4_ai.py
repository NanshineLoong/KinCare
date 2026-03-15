from __future__ import annotations

import importlib
import json
import sys
from datetime import UTC, datetime
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


def test_chat_session_message_stream_reads_authorized_data_and_returns_tool_events(client: TestClient) -> None:
    admin = register_user(
        client,
        email="owner@example.com",
        password="Secret123!",
        name="管理员",
    )
    managed_member = create_managed_member(client, admin["tokens"]["access_token"], "奶奶")
    create_observation(
        client,
        token=admin["tokens"]["access_token"],
        member_id=managed_member["id"],
    )
    create_care_plan(
        client,
        token=admin["tokens"]["access_token"],
        member_id=managed_member["id"],
    )

    session_response = client.post(
        "/api/chat/sessions",
        headers=auth_headers(admin["tokens"]["access_token"]),
        json={"member_id": managed_member["id"], "page_context": "home"},
    )

    assert session_response.status_code == 201, session_response.text
    session_id = session_response.json()["id"]

    with client.stream(
        "POST",
        f"/api/chat/sessions/{session_id}/messages",
        headers=auth_headers(admin["tokens"]["access_token"]),
        json={
            "content": "请看看奶奶最近的指标和提醒",
            "member_id": managed_member["id"],
            "page_context": "home",
        },
    ) as response:
        assert response.status_code == 200, response.text
        assert response.headers["content-type"].startswith("text/event-stream")
        events = parse_sse_events(response)

    assert [item["event"] for item in events] == [
        "session.started",
        "tool.started",
        "tool.result",
        "message.delta",
        "message.completed",
    ]
    assert events[2]["data"]["tool_name"] == "read_member_summary"
    assert "收缩压" in events[2]["data"]["content"]
    assert "早餐后服药" in events[4]["data"]["content"]


def test_chat_cannot_read_unauthorized_member_data(client: TestClient) -> None:
    admin = register_user(
        client,
        email="owner@example.com",
        password="Secret123!",
        name="管理员",
    )
    member = register_user(
        client,
        email="viewer@example.com",
        password="Secret123!",
        name="普通成员",
    )
    managed_member = create_managed_member(client, admin["tokens"]["access_token"], "外婆")

    response = client.post(
        "/api/chat/sessions",
        headers=auth_headers(member["tokens"]["access_token"]),
        json={"member_id": managed_member["id"], "page_context": "home"},
    )

    assert response.status_code == 403


def test_chat_high_risk_write_creates_draft_without_writing_observation(client: TestClient) -> None:
    admin = register_user(
        client,
        email="owner@example.com",
        password="Secret123!",
        name="管理员",
    )
    managed_member = create_managed_member(client, admin["tokens"]["access_token"], "奶奶")
    session_response = client.post(
        "/api/chat/sessions",
        headers=auth_headers(admin["tokens"]["access_token"]),
        json={"member_id": managed_member["id"], "page_context": "member-profile"},
    )
    assert session_response.status_code == 201, session_response.text

    with client.stream(
        "POST",
        f"/api/chat/sessions/{session_response.json()['id']}/messages",
        headers=auth_headers(admin["tokens"]["access_token"]),
        json={
            "content": "帮我记录奶奶今天心率 72",
            "member_id": managed_member["id"],
            "page_context": "member-profile",
        },
    ) as response:
        events = parse_sse_events(response)

    tool_result = next(item for item in events if item["event"] == "tool.result")
    assert tool_result["data"]["tool_name"] == "draft_health_record"
    assert tool_result["data"]["requires_confirmation"] is True
    assert tool_result["data"]["draft"]["observations"][0]["code"] == "heart-rate"

    observations_response = client.get(
        f"/api/members/{managed_member['id']}/observations",
        headers=auth_headers(admin["tokens"]["access_token"]),
    )
    assert observations_response.status_code == 200, observations_response.text
    assert observations_response.json() == []


def test_chat_confirm_draft_writes_records(client: TestClient) -> None:
    admin = register_user(
        client,
        email="owner@example.com",
        password="Secret123!",
        name="管理员",
    )
    managed_member = create_managed_member(client, admin["tokens"]["access_token"], "奶奶")
    draft = {
        "summary": "体检报告显示血压略高，建议继续监测。",
        "observations": [
            {
                "category": "chronic-vitals",
                "code": "bp-systolic",
                "display_name": "收缩压",
                "value": 132.0,
                "unit": "mmHg",
                "effective_at": "2026-03-10T08:00:00+08:00",
            }
        ],
        "conditions": [],
        "medications": [],
        "encounters": [],
        "care_plans": [
            {
                "category": "checkup-reminder",
                "title": "继续监测血压",
                "description": "未来 3 天持续记录晨间血压",
                "status": "active",
                "scheduled_at": "2026-03-13T08:00:00+08:00",
                "generated_by": "ai",
            }
        ],
    }

    confirm_response = client.post(
        "/api/chat/confirm",
        headers=auth_headers(admin["tokens"]["access_token"]),
        json={"member_id": managed_member["id"], "draft": draft},
    )
    assert confirm_response.status_code == 200, confirm_response.text
    assert confirm_response.json()["created_counts"] == {
        "observations": 1,
        "conditions": 0,
        "medications": 0,
        "encounters": 0,
        "care_plans": 1,
    }

    observations_response = client.get(
        f"/api/members/{managed_member['id']}/observations",
        headers=auth_headers(admin["tokens"]["access_token"]),
    )
    assert observations_response.status_code == 200, observations_response.text
    assert observations_response.json()[0]["source"] == "manual"
    assert "source_ref" not in observations_response.json()[0]


def test_transcription_endpoint_returns_text_and_handles_empty_audio(client: TestClient) -> None:
    admin = register_user(
        client,
        email="owner@example.com",
        password="Secret123!",
        name="管理员",
    )

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
    admin = register_user(
        client,
        email="owner@example.com",
        password="Secret123!",
        name="管理员",
    )
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
