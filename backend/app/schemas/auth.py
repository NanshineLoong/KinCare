from __future__ import annotations

import re
import unicodedata
from typing import Literal

from pydantic import BaseModel, field_validator

from app.schemas.member import MemberRead

USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9_\-\u3400-\u4DBF\u4E00-\u9FFF]{3,24}$")


def normalize_username(value: str) -> str:
    cleaned = unicodedata.normalize("NFKC", value.strip())
    if not cleaned:
        raise ValueError("Username is required.")
    if not USERNAME_PATTERN.fullmatch(cleaned):
        raise ValueError(
            "Username may only contain Chinese characters, letters, numbers, underscores, or hyphens, and must be 3-24 characters."
        )
    return cleaned


class RegisterRequest(BaseModel):
    username: str
    password: str
    email: str | None = None

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        return normalize_username(value)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters.")
        return value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip().lower()
        if not cleaned:
            return None
        if "@" not in cleaned or "." not in cleaned.rsplit("@", maxsplit=1)[-1]:
            raise ValueError("A valid email address is required.")
        return cleaned


class LoginRequest(BaseModel):
    username: str
    password: str
    remember_me: bool = False

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        return normalize_username(value)


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserRead(BaseModel):
    id: str
    family_space_id: str
    username: str
    email: str | None
    preferred_language: Literal["zh", "en"] | None
    role: str
    created_at: str


class UserPreferencesUpdate(BaseModel):
    preferred_language: Literal["zh", "en"] | None = None


class UserPreferencesRead(BaseModel):
    preferred_language: Literal["zh", "en"] | None


class AuthResponse(BaseModel):
    user: UserRead
    member: MemberRead
    tokens: TokenPair


class RefreshResponse(TokenPair):
    pass
