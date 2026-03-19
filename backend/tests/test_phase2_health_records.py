from __future__ import annotations

import importlib
import sys
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


def grant_permission(
    client: TestClient,
    *,
    actor_access_token: str,
    context_member_id: str,
    user_account_id: str,
    permission_level: str,
    target_scope: str = "specific",
) -> dict[str, Any]:
    response = client.post(
        f"/api/members/{context_member_id}/permissions",
        json={
            "user_account_id": user_account_id,
            "permission_level": permission_level,
            "target_scope": target_scope,
        },
        headers=auth_headers(actor_access_token),
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
            "category": "情绪支持",
            "label": "情绪提醒",
            "value": "最近需要更多陪伴与休息。",
            "status": "alert",
            "generated_at": "2026-03-11T09:00:00+00:00",
        },
        "update_payload": {
            "value": "情绪状态稍有回稳，继续观察。",
            "status": "warning",
        },
        "assert_created": lambda item, expected: (
            item["category"] == expected["category"] and item["status"] == expected["status"]
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
            "icon_key": "medication",
            "time_slot": "晚间",
            "notes": "饭后半小时服用",
            "status": "active",
            "scheduled_at": "2026-03-11T20:00:00+00:00",
            "generated_by": "manual",
        },
        "update_payload": {
            "status": "completed",
            "notes": "已完成提醒",
            "completed_at": "2026-03-11T12:00:00+00:00",
        },
        "assert_created": lambda item, expected: (
            item["title"] == expected["title"]
            and item["icon_key"] == expected["icon_key"]
            and item["time_slot"] == expected["time_slot"]
        ),
        "assert_updated": lambda item, expected: (
            item["status"] == expected["status"]
            and item["notes"] == expected["notes"]
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

    for summary in [
        {
            "category": "血压趋势",
            "label": "血压控制",
            "value": "稳步好转",
            "status": "good",
            "generated_at": "2026-03-11T08:00:00+00:00",
        },
        {
            "category": "运动恢复",
            "label": "运动习惯",
            "value": "运动偏少",
            "status": "warning",
            "generated_at": "2026-03-11T08:05:00+00:00",
        },
        {
            "category": "情绪支持",
            "label": "情绪提醒",
            "value": "今天更需要陪伴与休息",
            "status": "alert",
            "generated_at": "2026-03-11T08:10:00+00:00",
        },
        {
            "category": "用药依从",
            "label": "服药记录",
            "value": "午后提醒仍待完成",
            "status": "warning",
            "generated_at": "2026-03-11T08:15:00+00:00",
        },
        {
            "category": "营养状态",
            "label": "早餐摄入",
            "value": "早餐蛋白质摄入偏少",
            "status": "warning",
            "generated_at": "2026-03-11T08:20:00+00:00",
        },
    ]:
        response = client.post(
            f"/api/members/{managed_member['id']}/health-summaries",
            json=summary,
            headers=headers,
        )
        assert response.status_code == 201, response.text

    for care_plan in [
        {
            "category": "medication-reminder",
            "title": "早餐后服药",
            "description": "08:30 服用降压药",
            "icon_key": "medication",
            "time_slot": "清晨",
            "assignee_member_id": managed_member["id"],
            "notes": "饭后 30 分钟内完成",
            "status": "active",
            "scheduled_at": today_morning,
            "generated_by": "manual",
        },
        {
            "category": "daily-tip",
            "title": "睡前补水",
            "description": "睡前少量温水，避免夜间口干。",
            "icon_key": "rest",
            "time_slot": "晚间",
            "assignee_member_id": managed_member["id"],
            "notes": "控制在半杯以内",
            "status": "active",
            "scheduled_at": datetime(today.year, today.month, today.day, 20, 30, tzinfo=UTC).isoformat(),
            "generated_by": "manual",
        },
        {
            "category": "checkup-reminder",
            "title": "周五复诊",
            "description": "提前准备病历",
            "icon_key": "checkup",
            "time_slot": "上午",
            "assignee_member_id": managed_member["id"],
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
    assert [item["label"] for item in managed_summary["health_summaries"]] == [
        "早餐摄入",
        "服药记录",
        "情绪提醒",
        "运动习惯",
        "血压控制",
    ]
    assert managed_summary["health_summaries"][2]["status"] == "alert"

    assert [item["title"] for item in payload["today_reminders"]] == ["早餐后服药", "睡前补水"]
    assert [item["time_slot"] for item in payload["today_reminders"]] == ["清晨", "晚间"]
    assert payload["today_reminders"][0]["member_name"] == "奶奶"
    assert payload["today_reminders"][0]["icon_key"] == "medication"
    assert payload["today_reminders"][1]["notes"] == "控制在半杯以内"
    assert [group["time_slot"] for group in payload["reminder_groups"]] == ["清晨", "晚间"]
    assert [item["title"] for item in payload["reminder_groups"][0]["reminders"]] == ["早餐后服药"]
    assert payload["reminder_groups"][0]["reminders"][0]["assignee_member_id"] == managed_member["id"]


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

    read_grant = grant_permission(
        client,
        actor_access_token=admin["tokens"]["access_token"],
        context_member_id=managed_member["id"],
        user_account_id=caregiver["user"]["id"],
        permission_level="read",
    )
    assert read_grant["permission_level"] == "read"
    assert read_grant["target_scope"] == "specific"

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

    write_grant = grant_permission(
        client,
        actor_access_token=admin["tokens"]["access_token"],
        context_member_id=managed_member["id"],
        user_account_id=caregiver["user"]["id"],
        permission_level="write",
    )
    assert write_grant["permission_level"] == "write"

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


def test_all_scope_write_grant_applies_to_every_member_in_family_space(client: TestClient) -> None:
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
    grandma = create_managed_member(client, admin["tokens"]["access_token"], "奶奶")
    grandpa = create_managed_member(client, admin["tokens"]["access_token"], "爷爷")

    grant = grant_permission(
        client,
        actor_access_token=admin["tokens"]["access_token"],
        context_member_id=grandma["id"],
        user_account_id=caregiver["user"]["id"],
        permission_level="write",
        target_scope="all",
    )
    assert grant["target_scope"] == "all"
    assert grant["member_id"] is None

    for member in (grandma, grandpa):
        create_response = client.post(
            f"/api/members/{member['id']}/observations",
            json={
                "category": "body-vitals",
                "code": "heart-rate",
                "display_name": "心率",
                "value": 72.0,
                "unit": "bpm",
                "effective_at": "2026-03-11T09:00:00+00:00",
                "source": "manual",
            },
            headers=auth_headers(caregiver["tokens"]["access_token"]),
        )
        assert create_response.status_code == 201, create_response.text

    permissions_response = client.get(
        f"/api/members/{grandpa['id']}/permissions",
        headers=auth_headers(admin["tokens"]["access_token"]),
    )
    assert permissions_response.status_code == 200, permissions_response.text
    assert any(
        item["user_account_id"] == caregiver["user"]["id"]
        and item["permission_level"] == "write"
        and item["target_scope"] == "all"
        for item in permissions_response.json()
    )


def test_read_all_grant_expands_dashboard_visibility_across_family_members(client: TestClient) -> None:
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
    grandma = create_managed_member(client, admin["tokens"]["access_token"], "奶奶")
    grandpa = create_managed_member(client, admin["tokens"]["access_token"], "爷爷")

    for member, title, slot in (
        (grandma, "早餐后服药", "清晨"),
        (grandpa, "午后散步", "午后"),
    ):
        summary_response = client.post(
            f"/api/members/{member['id']}/health-summaries",
            json={
                "category": "日常关注",
                "label": f"{member['name']}摘要",
                "value": f"{member['name']}今天整体稳定。",
                "status": "good",
                "generated_at": "2026-03-11T08:00:00+00:00",
            },
            headers=auth_headers(admin["tokens"]["access_token"]),
        )
        assert summary_response.status_code == 201, summary_response.text

        care_plan_response = client.post(
            f"/api/members/{member['id']}/care-plans",
            json={
                "category": "daily-tip",
                "title": title,
                "description": f"{member['name']}的今日提醒",
                "icon_key": "general",
                "time_slot": slot,
                "assignee_member_id": member["id"],
                "status": "active",
                "scheduled_at": datetime.now(UTC).replace(hour=9, minute=0, second=0, microsecond=0).isoformat(),
                "generated_by": "manual",
            },
            headers=auth_headers(admin["tokens"]["access_token"]),
        )
        assert care_plan_response.status_code == 201, care_plan_response.text

    before_grant = client.get(
        "/api/dashboard",
        headers=auth_headers(caregiver["tokens"]["access_token"]),
    )
    assert before_grant.status_code == 200, before_grant.text
    assert [item["member"]["id"] for item in before_grant.json()["members"]] == [
        caregiver["member"]["id"]
    ]
    assert before_grant.json()["today_reminders"] == []

    grant_response = grant_permission(
        client,
        actor_access_token=admin["tokens"]["access_token"],
        context_member_id=grandma["id"],
        user_account_id=caregiver["user"]["id"],
        permission_level="read",
        target_scope="all",
    )
    assert grant_response["target_scope"] == "all"
    assert grant_response["permission_level"] == "read"

    dashboard_response = client.get(
        "/api/dashboard",
        headers=auth_headers(caregiver["tokens"]["access_token"]),
    )
    assert dashboard_response.status_code == 200, dashboard_response.text

    payload = dashboard_response.json()
    assert {item["member"]["name"] for item in payload["members"]} == {
        "管理员",
        "照护者",
        "奶奶",
        "爷爷",
    }
    assert {item["member_name"] for item in payload["today_reminders"]} == {"奶奶", "爷爷"}
    assert {item["title"] for item in payload["today_reminders"]} == {"早餐后服药", "午后散步"}
