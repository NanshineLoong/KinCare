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
            "category": "vital-signs",
            "code": "bp-systolic",
            "display_name": "收缩压",
            "value": 128.0,
            "unit": "mmHg",
            "effective_at": "2026-03-10T08:00:00+00:00",
            "source": "manual",
            "notes": "早餐后测量",
        },
        "update_payload": {
            "value": 122.0,
            "notes": "午后复测",
        },
        "assert_created": lambda item, expected: (
            item["code"] == expected["code"]
            and item["value"] == expected["value"]
            and item["unit"] == expected["unit"]
        ),
        "assert_updated": lambda item, expected: (
            item["value"] == expected["value"] and item["notes"] == expected["notes"]
        ),
    },
    {
        "resource": "conditions",
        "create_payload": {
            "category": "chronic",
            "code": "hypertension",
            "display_name": "高血压",
            "clinical_status": "active",
            "onset_date": "2023-06-01",
            "severity": "moderate",
            "source": "manual",
            "notes": "持续监测",
        },
        "update_payload": {
            "clinical_status": "resolved",
            "abatement_date": "2026-03-01",
            "notes": "近期状态稳定",
        },
        "assert_created": lambda item, expected: (
            item["display_name"] == expected["display_name"]
            and item["clinical_status"] == expected["clinical_status"]
        ),
        "assert_updated": lambda item, expected: (
            item["clinical_status"] == expected["clinical_status"]
            and item["abatement_date"] == expected["abatement_date"]
        ),
    },
    {
        "resource": "medications",
        "create_payload": {
            "medication_name": "缬沙坦",
            "dosage": "每日一次，每次 1 片",
            "status": "active",
            "start_date": "2026-02-01",
            "reason": "高血压",
            "prescribed_by": "协和医院",
            "source": "manual",
            "notes": "早餐后服用",
        },
        "update_payload": {
            "status": "completed",
            "end_date": "2026-03-01",
        },
        "assert_created": lambda item, expected: (
            item["medication_name"] == expected["medication_name"]
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
            "date": "2026-02-15",
            "summary": "常规复诊",
            "source": "manual",
        },
        "update_payload": {
            "department": "老年医学科",
            "summary": "复诊并调整用药",
        },
        "assert_created": lambda item, expected: (
            item["facility"] == expected["facility"] and item["date"] == expected["date"]
        ),
        "assert_updated": lambda item, expected: (
            item["department"] == expected["department"] and item["summary"] == expected["summary"]
        ),
    },
    {
        "resource": "documents",
        "create_payload": {
            "doc_type": "lab-result",
            "file_path": "uploads/report-1.pdf",
            "file_name": "report-1.pdf",
            "mime_type": "application/pdf",
            "extraction_status": "pending",
            "raw_extraction": {"summary": "待处理"},
        },
        "update_payload": {
            "extraction_status": "completed",
            "extracted_at": "2026-03-10T09:30:00+00:00",
            "raw_extraction": {"summary": "已抽取"},
        },
        "assert_created": lambda item, expected: (
            item["file_name"] == expected["file_name"]
            and item["extraction_status"] == expected["extraction_status"]
        ),
        "assert_updated": lambda item, expected: (
            item["extraction_status"] == expected["extraction_status"]
            and item["raw_extraction"] == expected["raw_extraction"]
        ),
    },
    {
        "resource": "care-plans",
        "create_payload": {
            "category": "medication-reminder",
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
            "category": "vital-signs",
            "code": "bp-systolic",
            "display_name": "收缩压",
            "value": 118.0,
            "unit": "mmHg",
            "effective_at": "2026-02-28T08:00:00+00:00",
            "source": "manual",
        },
        {
            "category": "vital-signs",
            "code": "bp-systolic",
            "display_name": "收缩压",
            "value": 121.0,
            "unit": "mmHg",
            "effective_at": "2026-03-02T08:00:00+00:00",
            "source": "manual",
        },
        {
            "category": "vital-signs",
            "code": "bp-systolic",
            "display_name": "收缩压",
            "value": 124.0,
            "unit": "mmHg",
            "effective_at": "2026-03-09T08:00:00+00:00",
            "source": "manual",
        },
        {
            "category": "vital-signs",
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
        f"/api/members/{managed_member['id']}/observations",
        json={
            "category": "vital-signs",
            "code": "bp-systolic",
            "display_name": "收缩压",
            "value": 126.0,
            "unit": "mmHg",
            "effective_at": "2026-03-11T08:00:00+00:00",
            "source": "manual",
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text

    response = client.post(
        f"/api/members/{managed_member['id']}/conditions",
        json={
            "category": "chronic",
            "code": "hypertension",
            "display_name": "高血压",
            "clinical_status": "active",
            "source": "manual",
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text

    response = client.post(
        f"/api/members/{managed_member['id']}/medications",
        json={
            "medication_name": "缬沙坦",
            "status": "active",
            "source": "manual",
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
            "category": "followup-reminder",
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
    assert managed_summary["latest_observations"]["bp-systolic"]["value"] == 126.0
    assert managed_summary["active_conditions"] == ["高血压"]
    assert managed_summary["active_medications_count"] == 1

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
            "category": "vital-signs",
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
            "category": "vital-signs",
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
            "category": "vital-signs",
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
            "category": "vital-signs",
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
