from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status

from app.core.database import Database
from app.core.dependencies import CurrentUser, get_current_user, get_database, require_admin
from app.schemas.member import (
    MemberCreate,
    MemberPermissionGrantCreate,
    MemberPermissionGrantRead,
    MemberRead,
    MemberUpdate,
)
from app.services.health_records import (
    grant_member_permission,
    list_member_permissions,
    revoke_member_permission,
)
from app.services.members import create_member, delete_member, get_member, list_members, update_member


router = APIRouter(prefix="/api/members", tags=["members"])


@router.get("", response_model=list[MemberRead])
def read_members(
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[dict[str, object]]:
    return list_members(database, current_user)


@router.post("", response_model=MemberRead, status_code=status.HTTP_201_CREATED)
def add_member(
    request: MemberCreate,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(require_admin),
) -> dict[str, object]:
    return create_member(request, database, current_user)


@router.get("/{member_id}", response_model=MemberRead)
def read_member(
    member_id: str,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, object]:
    return get_member(member_id, database, current_user)


@router.put("/{member_id}", response_model=MemberRead)
def edit_member(
    member_id: str,
    request: MemberUpdate,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, object]:
    return update_member(member_id, request, database, current_user)


@router.get("/{member_id}/permissions", response_model=list[MemberPermissionGrantRead])
def read_member_permissions(
    member_id: str,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[dict[str, object]]:
    return list_member_permissions(member_id, database, current_user)


@router.post(
    "/{member_id}/permissions",
    response_model=MemberPermissionGrantRead,
    status_code=status.HTTP_201_CREATED,
)
def add_member_permission(
    member_id: str,
    request: MemberPermissionGrantCreate,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, object]:
    return grant_member_permission(
        member_id,
        user_account_id=request.user_account_id,
        permission_level=request.permission_level,
        target_scope=request.target_scope,
        database=database,
        current_user=current_user,
    )


@router.delete("/{member_id}/permissions/{grant_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member_permission(
    member_id: str,
    grant_id: str,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> Response:
    revoke_member_permission(member_id, grant_id, database, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    member_id: str,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(require_admin),
) -> Response:
    delete_member(member_id, database, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
