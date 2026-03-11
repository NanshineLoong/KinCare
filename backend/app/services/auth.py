from __future__ import annotations

from fastapi import HTTPException, status

from app.core.config import Settings
from app.core.database import Database
from app.core.security import TokenError, create_token, decode_token, hash_password, verify_password
from app.schemas.auth import LoginRequest, RefreshRequest, RegisterRequest
from app.services import repository


def _token_pair(user: dict[str, str], settings: Settings) -> dict[str, str]:
    return {
        "access_token": create_token(
            subject=user["id"],
            family_space_id=user["family_space_id"],
            role=user["role"],
            token_type="access",
            secret=settings.jwt_secret,
            ttl_seconds=settings.access_token_ttl_seconds,
        ),
        "refresh_token": create_token(
            subject=user["id"],
            family_space_id=user["family_space_id"],
            role=user["role"],
            token_type="refresh",
            secret=settings.jwt_secret,
            ttl_seconds=settings.refresh_token_ttl_seconds,
        ),
        "token_type": "bearer",
    }


def _public_user(user: dict[str, str]) -> dict[str, str]:
    return {
        "id": user["id"],
        "family_space_id": user["family_space_id"],
        "email": user["email"],
        "role": user["role"],
        "created_at": user["created_at"],
    }


def register_user(request: RegisterRequest, database: Database, settings: Settings) -> dict[str, object]:
    with database.connection() as connection:
        existing_user = repository.get_user_by_email(connection, request.email)
        if existing_user is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered.")

        family_space = repository.get_family_space(connection)
        user_count = repository.count_users(connection)
        role = "admin" if user_count == 0 else "member"

        if family_space is None:
            family_space = repository.create_family_space(connection, name=f"{request.name} 的家")

        user = repository.create_user(
            connection,
            family_space_id=family_space["id"],
            email=request.email,
            password_hash=hash_password(request.password),
            role=role,
        )
        member = repository.create_member(
            connection,
            family_space_id=family_space["id"],
            user_account_id=user["id"],
            name=request.name,
        )

    return {
        "user": _public_user(user),
        "member": member,
        "tokens": _token_pair(user, settings),
    }


def login_user(request: LoginRequest, database: Database, settings: Settings) -> dict[str, object]:
    with database.connection() as connection:
        user = repository.get_user_by_email(connection, request.email)
        if user is None or not verify_password(request.password, user["password_hash"]):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
        member = repository.get_member_by_user_account_id(connection, user["id"])

    if member is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Linked member profile missing.")

    return {
        "user": _public_user(user),
        "member": member,
        "tokens": _token_pair(user, settings),
    }


def refresh_tokens(request: RefreshRequest, database: Database, settings: Settings) -> dict[str, str]:
    try:
        payload = decode_token(request.refresh_token, settings.jwt_secret)
    except TokenError as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(error)) from error

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type.")

    with database.connection() as connection:
        user = repository.get_user_by_id(connection, str(payload.get("sub", "")))

    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")

    return _token_pair(user, settings)
