from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status

from app.core.database import Database
from app.core.dependencies import CurrentUser, get_database, require_admin
from app.services.family_space import delete_family_space


router = APIRouter(prefix="/api/family-space", tags=["family-space"])


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def remove_family_space(
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(require_admin),
) -> Response:
    delete_family_space(database, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
