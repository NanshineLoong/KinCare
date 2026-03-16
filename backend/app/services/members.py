from __future__ import annotations

from fastapi import HTTPException, status

from app.core.database import Database
from app.core.dependencies import CurrentUser
from app.schemas.member import MemberCreate, MemberUpdate
from app.services import repository
from app.services.health_records import PERMISSION_LEVEL_RANK, resolve_member_permission_level


def _member_with_permission(
    connection: object,
    member: dict[str, object],
    current_user: CurrentUser,
) -> dict[str, object]:
    permission_level = resolve_member_permission_level(connection, current_user, str(member["id"]))
    return {
        **member,
        "permission_level": permission_level,
    }


def list_members(database: Database, current_user: CurrentUser) -> list[dict[str, object]]:
    with database.connection() as connection:
        members = repository.list_members_by_family_space(connection, current_user.family_space_id)
        return [_member_with_permission(connection, member, current_user) for member in members]


def create_member(
    request: MemberCreate,
    database: Database,
    current_user: CurrentUser,
) -> dict[str, object]:
    with database.connection() as connection:
        member = repository.create_member(
            connection,
            family_space_id=current_user.family_space_id,
            name=request.name,
            gender=request.gender,
            birth_date=request.birth_date,
            height_cm=request.height_cm,
            blood_type=request.blood_type,
            avatar_url=request.avatar_url,
        )
        return _member_with_permission(connection, member, current_user)


def get_member(member_id: str, database: Database, current_user: CurrentUser) -> dict[str, object]:
    with database.connection() as connection:
        member = repository.get_member_by_id(connection, member_id)
        if member is None or member["family_space_id"] != current_user.family_space_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found.")

        permission_level = resolve_member_permission_level(connection, current_user, member_id)
        if PERMISSION_LEVEL_RANK[permission_level] < PERMISSION_LEVEL_RANK["read"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions.")
        return {
            **member,
            "permission_level": permission_level,
        }


def update_member(
    member_id: str,
    request: MemberUpdate,
    database: Database,
    current_user: CurrentUser,
) -> dict[str, object]:
    changes = request.model_dump(exclude_none=True)
    with database.connection() as connection:
        member = repository.get_member_by_id(connection, member_id)
        if member is None or member["family_space_id"] != current_user.family_space_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found.")

        permission_level = resolve_member_permission_level(connection, current_user, member_id)
        if PERMISSION_LEVEL_RANK[permission_level] < PERMISSION_LEVEL_RANK["write"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions.")
        if not changes:
            return {
                **member,
                "permission_level": permission_level,
            }

        updated_member = repository.update_member(connection, member_id, changes)
        return {
            **updated_member,
            "permission_level": permission_level,
        }


def delete_member(member_id: str, database: Database, current_user: CurrentUser) -> None:
    with database.connection() as connection:
        member = repository.get_member_by_id(connection, member_id)
        if member is None or member["family_space_id"] != current_user.family_space_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found.")
        if member["user_account_id"] is not None:
            repository.delete_user(connection, member["user_account_id"])
        repository.delete_member(connection, member_id)
