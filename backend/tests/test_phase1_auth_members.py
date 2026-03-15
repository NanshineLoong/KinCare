import base64
import hashlib
import hmac
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
    monkeypatch.setenv("HOMEVITAL_JWT_SECRET", "phase-1-test-secret")
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

    assert response.status_code == 201
    return response.json()


def login_user(client: TestClient, *, email: str, password: str) -> dict[str, Any]:
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )

    assert response.status_code == 200
    return response.json()


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


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


def test_first_registration_creates_admin_family_space_and_member(client: TestClient) -> None:
    payload = register_user(
        client,
        email="owner@example.com",
        password="Secret123!",
        name="王医生",
    )

    assert payload["user"]["email"] == "owner@example.com"
    assert payload["user"]["role"] == "admin"
    assert payload["member"]["name"] == "王医生"
    assert payload["member"]["user_account_id"] == payload["user"]["id"]
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
        email="owner@example.com",
        password="Secret123!",
        name="张小满",
    )

    logged_in = login_user(
        client,
        email="owner@example.com",
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


def test_member_cannot_create_or_delete_other_members(client: TestClient) -> None:
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
        email="owner@example.com",
        password="Secret123!",
        name="管理员",
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
    }

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
        json={"email": "member@example.com", "password": "Secret123!"},
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
