from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, field_validator


Gender = Literal["male", "female", "other", "unknown"]
PermissionLevel = Literal["none", "read", "write", "manage"]
GrantedPermissionLevel = Literal["read", "write", "manage"]
PermissionScope = Literal["specific", "all"]


class MemberBase(BaseModel):
    name: str
    gender: Gender = "unknown"
    birth_date: str | None = None
    height_cm: float | None = None
    blood_type: str | None = None
    avatar_url: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Name is required.")
        return cleaned


class MemberCreate(MemberBase):
    pass


class MemberUpdate(BaseModel):
    name: str | None = None
    gender: Gender | None = None
    birth_date: str | None = None
    height_cm: float | None = None
    blood_type: str | None = None
    avatar_url: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Name is required.")
        return cleaned


class MemberRead(MemberBase):
    id: str
    family_space_id: str
    user_account_id: str | None = None
    created_at: str
    updated_at: str
    permission_level: PermissionLevel


class MemberPermissionGrantCreate(BaseModel):
    user_account_id: str
    permission_level: GrantedPermissionLevel
    target_scope: PermissionScope = "specific"

    @field_validator("user_account_id")
    @classmethod
    def validate_user_account_id(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("User account id is required.")
        return cleaned


class MemberPermissionGrantRead(BaseModel):
    id: str
    member_id: str | None = None
    user_account_id: str
    permission_level: GrantedPermissionLevel
    target_scope: PermissionScope
    created_at: str
    user_email: str
    user_role: str
    user_member_id: str | None = None
    user_member_name: str | None = None
