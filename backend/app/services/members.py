from __future__ import annotations

from fastapi import HTTPException, status

from app.core.database import Database
from app.core.dependencies import CurrentUser
from app.schemas.member import MemberCreate, MemberUpdate
from app.services import repository


def list_members(database: Database, current_user: CurrentUser) -> list[dict[str, object]]:
    with database.connection() as connection:
        return repository.list_members_by_family_space(connection, current_user.family_space_id)


def create_member(
    request: MemberCreate,
    database: Database,
    current_user: CurrentUser,
) -> dict[str, object]:
    with database.connection() as connection:
        return repository.create_member(
            connection,
            family_space_id=current_user.family_space_id,
            name=request.name,
            gender=request.gender,
            birth_date=request.birth_date,
            blood_type=request.blood_type,
            allergies=request.allergies,
            medical_history=request.medical_history,
            avatar_url=request.avatar_url,
        )


def get_member(member_id: str, database: Database, current_user: CurrentUser) -> dict[str, object]:
    with database.connection() as connection:
        member = repository.get_member_by_id(connection, member_id)

    if member is None or member["family_space_id"] != current_user.family_space_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found.")

    if current_user.role != "admin" and current_user.member_id != member_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions.")

    return member


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
        if current_user.role != "admin" and current_user.member_id != member_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions.")
        if not changes:
            return member
        return repository.update_member(connection, member_id, changes)


def delete_member(member_id: str, database: Database, current_user: CurrentUser) -> None:
    with database.connection() as connection:
        member = repository.get_member_by_id(connection, member_id)
        if member is None or member["family_space_id"] != current_user.family_space_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found.")
        if member["user_account_id"] is not None:
            repository.delete_user(connection, member["user_account_id"])
        repository.delete_member(connection, member_id)
