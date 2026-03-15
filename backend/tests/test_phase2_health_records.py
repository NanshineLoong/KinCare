from __future__ import annotations

import importlib
import sys
import uuid
from datetime import UTC, datetime, timedelta
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
    monkeypatch.setenv("HOMEVITAL_JWT_SECRET", "phase-2-test-secret")
    monkeypatch.setenv("HOMEVITAL_ACCESS_TOKEN_TTL_SECONDS", "900")
    monkeypatch.setenv("HOMEVITAL_REFRESH_TOKEN_TTL_SECONDS", "3600")

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


RESOURCE_CASES = [
    {
        "resource": "observations",
        "create_payload": {
            "category": "chronic-vitals",
            "code": "bp-systolic",
            "display_name": "收缩压",
            "value": 128.0,
            "unit": "mmHg",
            "context": "postmeal-2h",
            "effective_at": "2026-03-10T08:00:00+00:00",
            "source": "manual",
            "device_name": "Omron",
            "notes": "早餐后测量",
        },
        "update_payload": {
            "value": 122.0,
            "context": "fasting",
            "notes": "午后复测",
        },
        "assert_created": lambda item, expected: (
            item["code"] == expected["code"]
            and item["value"] == expected["value"]
            and item["unit"] == expected["unit"]
            and item["context"] == expected["context"]
        ),
        "assert_updated": lambda item, expected: (
            item["value"] == expected["value"]
            and item["context"] == expected["context"]
            and item["notes"] == expected["notes"]
        ),
    },
    {
        "resource": "conditions",
        "create_payload": {
            "category": "chronic",
            "display_name": "高血压",
            "clinical_status": "active",
            "onset_date": "2023-06-01",
            "source": "manual",
            "notes": "持续监测",
        },
        "update_payload": {
            "category": "family-history",
            "clinical_status": "inactive",
            "notes": "近期状态稳定",
        },
        "assert_created": lambda item, expected: (
            item["display_name"] == expected["display_name"]
            and item["clinical_status"] == expected["clinical_status"]
        ),
        "assert_updated": lambda item, expected: (
            item["category"] == expected["category"]
            and item["clinical_status"] == expected["clinical_status"]
            and item["notes"] == expected["notes"]
        ),
    },
    {
        "resource": "medications",
        "create_payload": {
            "name": "缬沙坦",
            "dosage_description": "每日一次，每次 1 片",
            "status": "active",
            "start_date": "2026-02-01",
            "indication": "高血压",
            "source": "manual",
        },
        "update_payload": {
            "status": "stopped",
            "end_date": "2026-03-01",
        },
        "assert_created": lambda item, expected: (
            item["name"] == expected["name"]
            and item["status"] == expected["status"]
        ),
        "assert_updated": lambda item, expected: (
            item["status"] == expected["status"] and item["end_date"] == expected["end_date"]
        ),
    },
    {
        "resource": "encounters",
        "create_payload": {
            "type": "outpatient",
            "facility": "协和医院",
            "department": "心内科",
            "attending_physician": "李建国 副主任医师",
            "date": "2026-02-15",
            "summary": "常规复诊",
            "source": "manual",
        },
        "update_payload": {
            "department": "老年医学科",
            "attending_physician": "赵医生",
            "summary": "复诊并调整用药",
        },
        "assert_created": lambda item, expected: (
            item["facility"] == expected["facility"]
            and item["attending_physician"] == expected["attending_physician"]
            and item["date"] == expected["date"]
        ),
        "assert_updated": lambda item, expected: (
            item["department"] == expected["department"]
            and item["attending_physician"] == expected["attending_physician"]
            and item["summary"] == expected["summary"]
        ),
    },
    {
        "resource": "sleep-records",
        "create_payload": {
            "start_at": "2026-03-09T22:30:00+00:00",
            "end_at": "2026-03-10T06:30:00+00:00",
            "total_minutes": 480,
            "deep_minutes": 85,
            "rem_minutes": 110,
            "light_minutes": 255,
            "awake_minutes": 30,
            "efficiency_score": 92.5,
            "is_nap": False,
            "source": "device",
            "device_name": "Apple Watch",
        },
        "update_payload": {
            "efficiency_score": 94.0,
            "is_nap": True,
        },
        "assert_created": lambda item, expected: (
            item["total_minutes"] == expected["total_minutes"]
            and item["device_name"] == expected["device_name"]
        ),
        "assert_updated": lambda item, expected: (
            item["efficiency_score"] == expected["efficiency_score"]
            and item["is_nap"] == expected["is_nap"]
        ),
    },
    {
        "resource": "workout-records",
        "create_payload": {
            "type": "walking",
            "start_at": "2026-03-11T07:00:00+00:00",
            "end_at": "2026-03-11T07:45:00+00:00",
            "duration_minutes": 45,
            "energy_burned": 210.5,
            "distance_meters": 3800.0,
            "avg_heart_rate": 108,
            "source": "device",
            "device_name": "Apple Watch",
            "notes": "晨间快走",
        },
        "update_payload": {
            "type": "hiking",
            "notes": "公园徒步",
        },
        "assert_created": lambda item, expected: (
            item["type"] == expected["type"] and item["duration_minutes"] == expected["duration_minutes"]
        ),
        "assert_updated": lambda item, expected: (
            item["type"] == expected["type"] and item["notes"] == expected["notes"]
        ),
    },
    {
        "resource": "health-summaries",
        "create_payload": {
            "category": "lifestyle",
            "label": "运动习惯",
            "value": "本周步数稳定",
            "status": "good",
            "generated_at": "2026-03-11T09:00:00+00:00",
        },
        "update_payload": {
            "value": "本周运动偏少",
            "status": "warning",
        },
        "assert_created": lambda item, expected: (
            item["label"] == expected["label"] and item["status"] == expected["status"]
        ),
        "assert_updated": lambda item, expected: (
            item["value"] == expected["value"] and item["status"] == expected["status"]
        ),
    },
    {
        "resource": "care-plans",
        "create_payload": {
            "category": "checkup-reminder",
            "title": "晚间服药",
            "description": "20:00 服用降压药",
            "status": "active",
            "scheduled_at": "2026-03-11T20:00:00+00:00",
            "generated_by": "manual",
        },
        "update_payload": {
            "status": "completed",
            "completed_at": "2026-03-11T12:00:00+00:00",
        },
        "assert_created": lambda item, expected: (
            item["title"] == expected["title"] and item["status"] == expected["status"]
        ),
        "assert_updated": lambda item, expected: (
            item["status"] == expected["status"]
            and item["completed_at"] == expected["completed_at"]
        ),
    },
]


@pytest.mark.parametrize("case", RESOURCE_CASES, ids=[case["resource"] for case in RESOURCE_CASES])
def test_admin_can_crud_health_resources(client: TestClient, case: dict[str, Any]) -> None:
    admin = register_user(
        client,
        email="owner@example.com",
        password="Secret123!",
        name="管理员",
    )
    managed_member = create_managed_member(client, admin["tokens"]["access_token"], "奶奶")
    collection_path = f"/api/members/{managed_member['id']}/{case['resource']}"

    create_response = client.post(
        collection_path,
        json=case["create_payload"],
        headers=auth_headers(admin["tokens"]["access_token"]),
    )

    assert create_response.status_code == 201, create_response.text
    created_item = create_response.json()
    assert created_item["member_id"] == managed_member["id"]
    assert case["assert_created"](created_item, case["create_payload"])

    list_response = client.get(
        collection_path,
        headers=auth_headers(admin["tokens"]["access_token"]),
    )

    assert list_response.status_code == 200, list_response.text
    listed_items = list_response.json()
    assert len(listed_items) == 1
    assert listed_items[0]["id"] == created_item["id"]

    detail_path = f"{collection_path}/{created_item['id']}"
    detail_response = client.get(
        detail_path,
        headers=auth_headers(admin["tokens"]["access_token"]),
    )

    assert detail_response.status_code == 200, detail_response.text
    assert detail_response.json()["id"] == created_item["id"]

    update_response = client.put(
        detail_path,
        json=case["update_payload"],
        headers=auth_headers(admin["tokens"]["access_token"]),
    )

    assert update_response.status_code == 200, update_response.text
    updated_item = update_response.json()
    assert case["assert_updated"](updated_item, case["update_payload"])

    delete_response = client.delete(
        detail_path,
        headers=auth_headers(admin["tokens"]["access_token"]),
    )

    assert delete_response.status_code == 204, delete_response.text

    missing_response = client.get(
        detail_path,
        headers=auth_headers(admin["tokens"]["access_token"]),
    )

    assert missing_response.status_code == 404, missing_response.text


def test_observation_trend_filters_by_code_and_time_range(client: TestClient) -> None:
    admin = register_user(
        client,
        email="owner@example.com",
        password="Secret123!",
        name="管理员",
    )
    managed_member = create_managed_member(client, admin["tokens"]["access_token"], "奶奶")
    observations_path = f"/api/members/{managed_member['id']}/observations"

    for payload in [
        {
            "category": "chronic-vitals",
            "code": "bp-systolic",
            "display_name": "收缩压",
            "value": 118.0,
            "unit": "mmHg",
            "effective_at": "2026-02-28T08:00:00+00:00",
            "source": "manual",
        },
        {
            "category": "chronic-vitals",
            "code": "bp-systolic",
            "display_name": "收缩压",
            "value": 121.0,
            "unit": "mmHg",
            "effective_at": "2026-03-02T08:00:00+00:00",
            "source": "manual",
        },
        {
            "category": "chronic-vitals",
            "code": "bp-systolic",
            "display_name": "收缩压",
            "value": 124.0,
            "unit": "mmHg",
            "effective_at": "2026-03-09T08:00:00+00:00",
            "source": "manual",
        },
        {
            "category": "body-vitals",
            "code": "heart-rate",
            "display_name": "心率",
            "value": 76.0,
            "unit": "bpm",
            "effective_at": "2026-03-05T08:00:00+00:00",
            "source": "manual",
        },
    ]:
        response = client.post(
            observations_path,
            json=payload,
            headers=auth_headers(admin["tokens"]["access_token"]),
        )
        assert response.status_code == 201, response.text

    trend_response = client.get(
        f"{observations_path}/trend",
        params={
            "code": "bp-systolic",
            "from": "2026-03-01T00:00:00+00:00",
            "to": "2026-03-10T23:59:59+00:00",
        },
        headers=auth_headers(admin["tokens"]["access_token"]),
    )

    assert trend_response.status_code == 200, trend_response.text
    payload = trend_response.json()
    assert payload["member_id"] == managed_member["id"]
    assert payload["code"] == "bp-systolic"
    assert [point["value"] for point in payload["points"]] == [121.0, 124.0]


def test_dashboard_returns_visible_member_summaries_and_today_reminders(client: TestClient) -> None:
    admin = register_user(
        client,
        email="owner@example.com",
        password="Secret123!",
        name="管理员",
    )
    managed_member = create_managed_member(client, admin["tokens"]["access_token"], "奶奶")
    headers = auth_headers(admin["tokens"]["access_token"])
    today = datetime.now(UTC).date()
    today_morning = datetime(today.year, today.month, today.day, 8, 30, tzinfo=UTC).isoformat()
    tomorrow_morning = datetime(
        *(today + timedelta(days=1)).timetuple()[:3],
        9,
        30,
        tzinfo=UTC,
    ).isoformat()

    response = client.post(
        f"/api/members/{managed_member['id']}/health-summaries",
        json={
            "category": "chronic-vitals",
            "label": "血压控制",
            "value": "稳步好转",
            "status": "good",
            "generated_at": "2026-03-11T08:00:00+00:00",
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text

    response = client.post(
        f"/api/members/{managed_member['id']}/health-summaries",
        json={
            "category": "lifestyle",
            "label": "运动习惯",
            "value": "运动偏少",
            "status": "warning",
            "generated_at": "2026-03-11T08:05:00+00:00",
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text

    for care_plan in [
        {
            "category": "medication-reminder",
            "title": "早餐后服药",
            "description": "08:30 服用降压药",
            "status": "active",
            "scheduled_at": today_morning,
            "generated_by": "manual",
        },
        {
            "category": "checkup-reminder",
            "title": "周五复诊",
            "description": "提前准备病历",
            "status": "active",
            "scheduled_at": tomorrow_morning,
            "generated_by": "manual",
        },
    ]:
        response = client.post(
            f"/api/members/{managed_member['id']}/care-plans",
            json=care_plan,
            headers=headers,
        )
        assert response.status_code == 201, response.text

    dashboard_response = client.get("/api/dashboard", headers=headers)

    assert dashboard_response.status_code == 200, dashboard_response.text
    payload = dashboard_response.json()
    assert len(payload["members"]) == 2

    managed_summary = next(
        item for item in payload["members"] if item["member"]["id"] == managed_member["id"]
    )
    assert [item["label"] for item in managed_summary["health_summaries"]] == ["运动习惯", "血压控制"]
    assert managed_summary["health_summaries"][0]["status"] == "warning"

    assert [item["title"] for item in payload["today_reminders"]] == ["早餐后服药"]
    assert payload["today_reminders"][0]["member_name"] == "奶奶"
def test_member_health_access_requires_self_or_grant(client: TestClient) -> None:
    admin = register_user(
        client,
        email="owner@example.com",
        password="Secret123!",
        name="管理员",
    )
    caregiver = register_user(
        client,
        email="caregiver@example.com",
        password="Secret123!",
        name="照护者",
    )
    managed_member = create_managed_member(client, admin["tokens"]["access_token"], "奶奶")

    observation_response = client.post(
        f"/api/members/{managed_member['id']}/observations",
        json={
            "category": "chronic-vitals",
            "code": "bp-systolic",
            "display_name": "收缩压",
            "value": 128.0,
            "unit": "mmHg",
            "effective_at": "2026-03-11T08:00:00+00:00",
            "source": "manual",
        },
        headers=auth_headers(admin["tokens"]["access_token"]),
    )
    assert observation_response.status_code == 201, observation_response.text

    forbidden_list = client.get(
        f"/api/members/{managed_member['id']}/observations",
        headers=auth_headers(caregiver["tokens"]["access_token"]),
    )
    assert forbidden_list.status_code == 403, forbidden_list.text

    with client.app.state.database.connection() as connection:
        connection.execute(
            """
            INSERT INTO member_access_grant (id, member_id, user_account_id, can_write, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                managed_member["id"],
                caregiver["user"]["id"],
                0,
                datetime(2026, 3, 11, tzinfo=UTC).isoformat(),
            ),
        )

    allowed_list = client.get(
        f"/api/members/{managed_member['id']}/observations",
        headers=auth_headers(caregiver["tokens"]["access_token"]),
    )
    assert allowed_list.status_code == 200, allowed_list.text
    assert len(allowed_list.json()) == 1

    forbidden_create = client.post(
        f"/api/members/{managed_member['id']}/observations",
        json={
            "category": "body-vitals",
            "code": "heart-rate",
            "display_name": "心率",
            "value": 76.0,
            "unit": "bpm",
            "effective_at": "2026-03-11T09:00:00+00:00",
            "source": "manual",
        },
        headers=auth_headers(caregiver["tokens"]["access_token"]),
    )
    assert forbidden_create.status_code == 403, forbidden_create.text

    with client.app.state.database.connection() as connection:
        connection.execute(
            """
            UPDATE member_access_grant
            SET can_write = 1
            WHERE member_id = ? AND user_account_id = ?
            """,
            (managed_member["id"], caregiver["user"]["id"]),
        )

    allowed_create = client.post(
        f"/api/members/{managed_member['id']}/observations",
        json={
            "category": "body-vitals",
            "code": "heart-rate",
            "display_name": "心率",
            "value": 76.0,
            "unit": "bpm",
            "effective_at": "2026-03-11T09:00:00+00:00",
            "source": "manual",
        },
        headers=auth_headers(caregiver["tokens"]["access_token"]),
    )
    assert allowed_create.status_code == 201, allowed_create.text

    self_create = client.post(
        f"/api/members/{caregiver['member']['id']}/observations",
        json={
            "category": "body-vitals",
            "code": "body-weight",
            "display_name": "体重",
            "value": 62.5,
            "unit": "kg",
            "effective_at": "2026-03-11T07:00:00+00:00",
            "source": "manual",
        },
        headers=auth_headers(caregiver["tokens"]["access_token"]),
    )
    assert self_create.status_code == 201, self_create.text
