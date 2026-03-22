import base64
from dataclasses import replace
import hashlib
import hmac
import importlib
import json
import sqlite3
import sys
import threading
import time
from typing import Any

import pytest
from fastapi.testclient import TestClient


def _clear_app_modules() -> None:
    for module_name in list(sys.modules):
        if module_name == "app" or module_name.startswith("app."):
            sys.modules.pop(module_name, None)


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch, tmp_path: Any) -> TestClient:
    monkeypatch.setenv("KINCARE_DB_PATH", str(tmp_path / "kincare.db"))
    monkeypatch.setenv("KINCARE_JWT_SECRET", "phase-1-test-secret")
    monkeypatch.setenv("KINCARE_ACCESS_TOKEN_TTL_SECONDS", "1800")
    monkeypatch.setenv("KINCARE_REFRESH_TOKEN_TTL_SECONDS", "1209600")
    monkeypatch.setenv("KINCARE_REMEMBER_ME_REFRESH_TOKEN_TTL_SECONDS", "2592000")
    monkeypatch.setenv("KINCARE_SKIP_DOTENV", "1")
    monkeypatch.setenv("KINCARE_AI_BASE_URL", "https://example.invalid/v1")
    monkeypatch.setenv("KINCARE_AI_API_KEY", "test-key")
    monkeypatch.setenv("KINCARE_AI_MODEL", "test-model")

    _clear_app_modules()
    main_module = importlib.import_module("app.main")

    with TestClient(main_module.app) as test_client:
        yield test_client


def register_user(
    client: TestClient,
    *,
    username: str | None = None,
    password: str,
    email: str | None = None,
    name: str | None = None,
) -> dict[str, Any]:
    actual_username = username or name
    assert actual_username is not None
    response = client.post(
        "/api/auth/register",
        json={"username": actual_username, "password": password, "email": email},
    )

    assert response.status_code == 201
    return response.json()


def login_user(client: TestClient, *, username: str, password: str) -> dict[str, Any]:
    response = client.post(
        "/api/auth/login",
        json={"username": username, "password": password},
    )

    assert response.status_code == 200
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


def encode_jwt(payload: dict[str, Any], secret: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    signing_input = ".".join(
        [
            base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip("="),
            base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("="),
        ]
    )
    signature = hmac.new(
        secret.encode(),
        signing_input.encode(),
        hashlib.sha256,
    ).digest()
    return ".".join(
        [
            signing_input,
            base64.urlsafe_b64encode(signature).decode().rstrip("="),
        ]
    )


def decode_jwt_payload(token: str) -> dict[str, Any]:
    _header, payload, _signature = token.split(".")
    padding = "=" * (-len(payload) % 4)
    return json.loads(base64.urlsafe_b64decode(f"{payload}{padding}".encode()))


def test_first_registration_creates_admin_family_space_and_member(client: TestClient) -> None:
    payload = register_user(
        client,
        username="王医生",
        password="Secret123!",
    )

    assert payload["user"]["username"] == "王医生"
    assert payload["user"]["email"] is None
    assert payload["user"]["role"] == "admin"
    assert payload["user"]["preferred_language"] is None
    assert payload["member"]["name"] == "王医生"
    assert payload["member"]["user_account_id"] == payload["user"]["id"]
    assert payload["member"]["permission_level"] == "manage"
    assert payload["tokens"]["access_token"]
    assert payload["tokens"]["refresh_token"]

    members_response = client.get(
        "/api/members",
        headers=auth_headers(payload["tokens"]["access_token"]),
    )

    assert members_response.status_code == 200
    assert len(members_response.json()) == 1


def test_login_and_refresh_support_expired_access_tokens(client: TestClient) -> None:
    registered = register_user(
        client,
        username="张小满",
        password="Secret123!",
    )

    logged_in = login_user(
        client,
        username="张小满",
        password="Secret123!",
    )

    expired_token = encode_jwt(
        {
            "sub": registered["user"]["id"],
            "family_space_id": registered["user"]["family_space_id"],
            "role": "admin",
            "type": "access",
            "exp": 1,
        },
        "phase-1-test-secret",
    )
    expired_response = client.get("/api/members", headers=auth_headers(expired_token))

    assert expired_response.status_code == 401

    refresh_response = client.post(
        "/api/auth/refresh",
        json={"refresh_token": logged_in["tokens"]["refresh_token"]},
    )

    assert refresh_response.status_code == 200
    refreshed = refresh_response.json()
    assert refreshed["access_token"] != logged_in["tokens"]["access_token"]
    assert refreshed["refresh_token"] != logged_in["tokens"]["refresh_token"]

    members_response = client.get(
        "/api/members",
        headers=auth_headers(refreshed["access_token"]),
    )

    assert members_response.status_code == 200


def test_user_can_update_preferred_language_and_login_returns_it(client: TestClient) -> None:
    registered = register_user(
        client,
        username="张小满",
        password="Secret123!",
    )

    update_response = client.put(
        "/api/auth/preferences",
        headers=auth_headers(registered["tokens"]["access_token"]),
        json={"preferred_language": "zh"},
    )

    assert update_response.status_code == 200, update_response.text
    assert update_response.json()["preferred_language"] == "zh"

    logged_in = login_user(
        client,
        username="张小满",
        password="Secret123!",
    )
    assert logged_in["user"]["preferred_language"] == "zh"


def test_update_preferences_waits_for_short_sqlite_write_lock(client: TestClient) -> None:
    registered = register_user(
        client,
        username="张小满",
        password="Secret123!",
    )
    database_path = client.app.state.database.database_path
    lock_connection = sqlite3.connect(database_path, timeout=0, check_same_thread=False)
    lock_connection.execute("BEGIN IMMEDIATE")

    def release_lock() -> None:
        time.sleep(0.1)
        lock_connection.commit()
        lock_connection.close()

    release_thread = threading.Thread(target=release_lock)
    release_thread.start()
    try:
        update_response = client.put(
            "/api/auth/preferences",
            headers=auth_headers(registered["tokens"]["access_token"]),
            json={"preferred_language": "zh"},
        )
    finally:
        release_thread.join()

    assert update_response.status_code == 200, update_response.text
    assert update_response.json()["preferred_language"] == "zh"


def test_login_with_remember_me_extends_refresh_session_to_30_days(client: TestClient) -> None:
    register_user(
        client,
        username="CaseUser",
        password="Secret123!",
    )

    regular_login_response = client.post(
        "/api/auth/login",
        json={"username": "caseuser", "password": "Secret123!", "remember_me": False},
    )
    assert regular_login_response.status_code == 200
    regular_payload = regular_login_response.json()
    regular_refresh_claims = decode_jwt_payload(regular_payload["tokens"]["refresh_token"])
    assert regular_refresh_claims["exp"] - regular_refresh_claims["iat"] == 1_209_600
    assert regular_refresh_claims["remember_session"] is False

    remembered_login_response = client.post(
        "/api/auth/login",
        json={"username": "CASEUSER", "password": "Secret123!", "remember_me": True},
    )
    assert remembered_login_response.status_code == 200
    remembered_payload = remembered_login_response.json()
    assert remembered_payload["member"]["permission_level"] == "manage"
    remembered_refresh_claims = decode_jwt_payload(remembered_payload["tokens"]["refresh_token"])
    assert remembered_refresh_claims["exp"] - remembered_refresh_claims["iat"] == 2_592_000
    assert remembered_refresh_claims["remember_session"] is True

    refresh_response = client.post(
        "/api/auth/refresh",
        json={"refresh_token": remembered_payload["tokens"]["refresh_token"]},
    )
    assert refresh_response.status_code == 200
    refreshed_claims = decode_jwt_payload(refresh_response.json()["refresh_token"])
    assert refreshed_claims["exp"] - refreshed_claims["iat"] == 2_592_000
    assert refreshed_claims["remember_session"] is True


def test_registration_rejects_duplicate_username_case_insensitively(client: TestClient) -> None:
    register_user(
        client,
        username="CaseUser",
        password="Secret123!",
    )

    response = client.post(
        "/api/auth/register",
        json={"username": "caseuser", "password": "Secret123!"},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Username already exists."


def test_registration_rejects_invalid_username_characters(client: TestClient) -> None:
    response = client.post(
        "/api/auth/register",
        json={"username": "张 三🙂", "password": "Secret123!"},
    )

    assert response.status_code == 422
    assert "Username may only contain Chinese characters" in response.text


def test_registration_rejects_duplicate_optional_email(client: TestClient) -> None:
    register_user(
        client,
        username="用户一",
        password="Secret123!",
        email="owner@example.com",
    )

    response = client.post(
        "/api/auth/register",
        json={"username": "用户二", "password": "Secret123!", "email": "owner@example.com"},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Email already in use."


def test_member_cannot_create_or_delete_other_members(client: TestClient) -> None:
    admin = register_user(
        client,
        username="管理员",
        password="Secret123!",
    )
    member = register_user(
        client,
        username="普通成员",
        password="Secret123!",
    )

    create_response = client.post(
        "/api/members",
        json={"name": "外婆", "gender": "female"},
        headers=auth_headers(member["tokens"]["access_token"]),
    )

    assert create_response.status_code == 403

    members_response = client.get(
        "/api/members",
        headers=auth_headers(member["tokens"]["access_token"]),
    )

    assert members_response.status_code == 200
    assert [item["name"] for item in members_response.json()] == ["管理员", "普通成员"]

    delete_response = client.delete(
        f"/api/members/{admin['member']['id']}",
        headers=auth_headers(member["tokens"]["access_token"]),
    )

    assert delete_response.status_code == 403


def test_admin_can_create_update_and_delete_managed_members(client: TestClient) -> None:
    admin = register_user(
        client,
        username="管理员",
        password="Secret123!",
    )

    create_response = client.post(
        "/api/members",
        json={
            "name": "奶奶",
            "gender": "female",
            "blood_type": "A+",
            "height_cm": 158.5,
        },
        headers=auth_headers(admin["tokens"]["access_token"]),
    )

    assert create_response.status_code == 201
    created_member = create_response.json()
    assert created_member["name"] == "奶奶"
    assert created_member["height_cm"] == 158.5
    assert set(created_member) == {
        "id",
        "family_space_id",
        "user_account_id",
        "name",
        "gender",
        "birth_date",
        "height_cm",
        "blood_type",
        "avatar_url",
        "created_at",
        "updated_at",
        "permission_level",
    }
    assert created_member["permission_level"] == "manage"

    detail_response = client.get(
        f"/api/members/{created_member['id']}",
        headers=auth_headers(admin["tokens"]["access_token"]),
    )

    assert detail_response.status_code == 200
    assert detail_response.json()["blood_type"] == "A+"

    update_response = client.put(
        f"/api/members/{created_member['id']}",
        json={"name": "奶奶", "blood_type": "O+", "height_cm": 160.0},
        headers=auth_headers(admin["tokens"]["access_token"]),
    )

    assert update_response.status_code == 200
    updated_member = update_response.json()
    assert updated_member["blood_type"] == "O+"
    assert updated_member["height_cm"] == 160.0

    delete_response = client.delete(
        f"/api/members/{created_member['id']}",
        headers=auth_headers(admin["tokens"]["access_token"]),
    )

    assert delete_response.status_code == 204

    missing_response = client.get(
        f"/api/members/{created_member['id']}",
        headers=auth_headers(admin["tokens"]["access_token"]),
    )

    assert missing_response.status_code == 404


def test_admin_can_delete_a_member_with_a_bound_user_account(client: TestClient) -> None:
    admin = register_user(
        client,
        email="owner@example.com",
        password="Secret123!",
        name="管理员",
    )
    member = register_user(
        client,
        email="member@example.com",
        password="Secret123!",
        name="普通成员",
    )

    delete_response = client.delete(
        f"/api/members/{member['member']['id']}",
        headers=auth_headers(admin["tokens"]["access_token"]),
    )

    assert delete_response.status_code == 204

    members_response = client.get(
        "/api/members",
        headers=auth_headers(admin["tokens"]["access_token"]),
    )
    assert [item["name"] for item in members_response.json()] == ["管理员"]

    login_response = client.post(
        "/api/auth/login",
        json={"username": "普通成员", "password": "Secret123!"},
    )
    assert login_response.status_code == 401


def test_admin_can_delete_the_entire_family_space_and_reset_registration_flow(client: TestClient) -> None:
    admin = register_user(
        client,
        email="owner@example.com",
        password="Secret123!",
        name="管理员",
    )
    member = register_user(
        client,
        email="member@example.com",
        password="Secret123!",
        name="普通成员",
    )

    delete_response = client.delete(
        "/api/family-space",
        headers=auth_headers(admin["tokens"]["access_token"]),
    )
    assert delete_response.status_code == 204

    stale_members_response = client.get(
        "/api/members",
        headers=auth_headers(member["tokens"]["access_token"]),
    )
    assert stale_members_response.status_code == 401

    new_admin = register_user(
        client,
        email="new-owner@example.com",
        password="Secret123!",
        name="新管理员",
    )
    assert new_admin["user"]["role"] == "admin"

    members_response = client.get(
        "/api/members",
        headers=auth_headers(new_admin["tokens"]["access_token"]),
    )
    assert [item["name"] for item in members_response.json()] == ["新管理员"]


def test_member_detail_and_list_include_permission_level_summary(client: TestClient) -> None:
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

    members_response = client.get(
        "/api/members",
        headers=auth_headers(caregiver["tokens"]["access_token"]),
    )

    assert members_response.status_code == 200
    permission_by_member = {
        item["name"]: item["permission_level"]
        for item in members_response.json()
    }
    assert permission_by_member == {
        "管理员": "none",
        "照护者": "write",
        "奶奶": "none",
    }

    detail_response = client.get(
        f"/api/members/{managed_member['id']}",
        headers=auth_headers(caregiver["tokens"]["access_token"]),
    )
    assert detail_response.status_code == 403

    grant_response = client.post(
        f"/api/members/{managed_member['id']}/permissions",
        json={
            "user_account_id": caregiver["user"]["id"],
            "permission_level": "read",
            "target_scope": "specific",
        },
        headers=auth_headers(admin["tokens"]["access_token"]),
    )
    assert grant_response.status_code == 201, grant_response.text

    detail_response = client.get(
        f"/api/members/{managed_member['id']}",
        headers=auth_headers(caregiver["tokens"]["access_token"]),
    )
    assert detail_response.status_code == 200
    assert detail_response.json()["permission_level"] == "read"


def test_manage_permission_allows_listing_granting_and_revoking_member_permissions(client: TestClient) -> None:
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
    helper = register_user(
        client,
        email="helper@example.com",
        password="Secret123!",
        name="协助者",
    )
    managed_member = create_managed_member(client, admin["tokens"]["access_token"], "奶奶")

    manage_response = client.post(
        f"/api/members/{managed_member['id']}/permissions",
        json={
            "user_account_id": caregiver["user"]["id"],
            "permission_level": "manage",
            "target_scope": "specific",
        },
        headers=auth_headers(admin["tokens"]["access_token"]),
    )
    assert manage_response.status_code == 201, manage_response.text

    list_response = client.get(
        f"/api/members/{managed_member['id']}/permissions",
        headers=auth_headers(caregiver["tokens"]["access_token"]),
    )
    assert list_response.status_code == 200, list_response.text
    assert list_response.json()[0]["permission_level"] == "manage"
    assert list_response.json()[0]["user_account_id"] == caregiver["user"]["id"]

    helper_grant = client.post(
        f"/api/members/{managed_member['id']}/permissions",
        json={
            "user_account_id": helper["user"]["id"],
            "permission_level": "read",
            "target_scope": "specific",
        },
        headers=auth_headers(caregiver["tokens"]["access_token"]),
    )
    assert helper_grant.status_code == 201, helper_grant.text

    helper_detail = client.get(
        f"/api/members/{managed_member['id']}",
        headers=auth_headers(helper["tokens"]["access_token"]),
    )
    assert helper_detail.status_code == 200
    assert helper_detail.json()["permission_level"] == "read"

    revoke_response = client.delete(
        f"/api/members/{managed_member['id']}/permissions/{helper_grant.json()['id']}",
        headers=auth_headers(caregiver["tokens"]["access_token"]),
    )
    assert revoke_response.status_code == 204, revoke_response.text

    helper_detail = client.get(
        f"/api/members/{managed_member['id']}",
        headers=auth_headers(helper["tokens"]["access_token"]),
    )
    assert helper_detail.status_code == 403


def test_admin_can_manage_daily_refresh_settings_and_updates_scheduler(client: TestClient) -> None:
    admin = register_user(
        client,
        email="owner@example.com",
        password="Secret123!",
        name="管理员",
    )
    member = register_user(
        client,
        email="member@example.com",
        password="Secret123!",
        name="普通成员",
    )

    read_response = client.get(
        "/api/admin/settings",
        headers=auth_headers(admin["tokens"]["access_token"]),
    )
    assert read_response.status_code == 200, read_response.text
    assert read_response.json() == {
        "health_summary_refresh_time": "05:00",
        "care_plan_refresh_time": "06:00",
        "ai_default_language": "en",
        "transcription": {
            "provider": "openai",
            "api_key": "test-key",
            "model": "gpt-4o-mini-transcribe",
            "language": "zh",
            "timeout": 30.0,
            "local_whisper_model": "small",
            "local_whisper_device": "auto",
            "local_whisper_compute_type": "default",
            "local_whisper_download_root": None,
        },
        "chat_model": {
            "base_url": "https://example.invalid/v1",
            "api_key": "test-key",
            "model": "test-model",
        },
    }

    forbidden_response = client.get(
        "/api/admin/settings",
        headers=auth_headers(member["tokens"]["access_token"]),
    )
    assert forbidden_response.status_code == 403

    update_response = client.put(
        "/api/admin/settings",
        json={
            "health_summary_refresh_time": "07:30",
            "care_plan_refresh_time": "08:45",
            "ai_default_language": "zh",
            "transcription": {
                "provider": "local_whisper",
                "language": "en",
                "timeout": 12.5,
                "local_whisper_model": "whisper-small",
                "local_whisper_device": "cpu",
                "local_whisper_compute_type": "int8",
                "local_whisper_download_root": "/tmp/whisper-cache",
            },
            "chat_model": {
                "base_url": "https://llm.example/v1",
                "api_key": "new-ai-key",
                "model": "gpt-4.1-nano",
            },
        },
        headers=auth_headers(admin["tokens"]["access_token"]),
    )
    assert update_response.status_code == 200, update_response.text
    assert update_response.json() == {
        "health_summary_refresh_time": "07:30",
        "care_plan_refresh_time": "08:45",
        "ai_default_language": "zh",
        "transcription": {
            "provider": "local_whisper",
            "api_key": "new-ai-key",
            "model": "gpt-4o-mini-transcribe",
            "language": "en",
            "timeout": 12.5,
            "local_whisper_model": "whisper-small",
            "local_whisper_device": "cpu",
            "local_whisper_compute_type": "int8",
            "local_whisper_download_root": "/tmp/whisper-cache",
        },
        "chat_model": {
            "base_url": "https://llm.example/v1",
            "api_key": "new-ai-key",
            "model": "gpt-4.1-nano",
        },
    }

    scheduler = client.app.state.scheduler
    summary_job = scheduler.get_job("builtin.refresh_health_summaries")
    care_plan_job = scheduler.get_job("builtin.refresh_daily_care_plans")
    assert summary_job is not None
    assert care_plan_job is not None
    assert "hour='7'" in str(summary_job.trigger)
    assert "minute='30'" in str(summary_job.trigger)
    assert "hour='8'" in str(care_plan_job.trigger)
    assert "minute='45'" in str(care_plan_job.trigger)
    assert client.app.state.settings.ai_base_url == "https://llm.example/v1"
    assert client.app.state.settings.ai_api_key == "new-ai-key"
    assert client.app.state.settings.ai_model == "gpt-4.1-nano"
    assert client.app.state.settings.stt_provider == "local_whisper"
    assert client.app.state.settings.stt_language == "en"
    assert client.app.state.settings.stt_timeout_seconds == 12.5
    assert client.app.state.settings.local_whisper_model == "whisper-small"
    assert client.app.state.settings.local_whisper_device == "cpu"
    assert client.app.state.settings.local_whisper_compute_type == "int8"
    assert client.app.state.settings.local_whisper_download_root == "/tmp/whisper-cache"

    saved_response = client.get(
        "/api/admin/settings",
        headers=auth_headers(admin["tokens"]["access_token"]),
    )
    assert saved_response.status_code == 200, saved_response.text
    assert saved_response.json() == {
        "health_summary_refresh_time": "07:30",
        "care_plan_refresh_time": "08:45",
        "ai_default_language": "zh",
        "transcription": {
            "provider": "local_whisper",
            "api_key": "new-ai-key",
            "model": "gpt-4o-mini-transcribe",
            "language": "en",
            "timeout": 12.5,
            "local_whisper_model": "whisper-small",
            "local_whisper_device": "cpu",
            "local_whisper_compute_type": "int8",
            "local_whisper_download_root": "/tmp/whisper-cache",
        },
        "chat_model": {
            "base_url": "https://llm.example/v1",
            "api_key": "new-ai-key",
            "model": "gpt-4.1-nano",
        },
    }


def test_admin_can_clear_local_whisper_download_root_even_when_base_settings_define_one(
    client: TestClient,
) -> None:
    admin = register_user(
        client,
        email="owner@example.com",
        password="Secret123!",
        name="管理员",
    )
    client.app.state.base_settings = replace(
        client.app.state.base_settings,
        local_whisper_download_root="/models/whisper",
    )
    client.app.state.settings = replace(
        client.app.state.settings,
        local_whisper_download_root="/models/whisper",
    )

    update_response = client.put(
        "/api/admin/settings",
        json={
            "transcription": {
                "provider": "local_whisper",
                "local_whisper_download_root": None,
            },
        },
        headers=auth_headers(admin["tokens"]["access_token"]),
    )

    assert update_response.status_code == 200, update_response.text
    assert update_response.json()["transcription"]["local_whisper_download_root"] is None
    assert client.app.state.settings.local_whisper_download_root == ""
