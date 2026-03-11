from __future__ import annotations

from fastapi import HTTPException, status

from app.core.database import Database
from app.core.dependencies import CurrentUser
from app.services import repository


def delete_family_space(database: Database, current_user: CurrentUser) -> None:
    with database.connection() as connection:
        family_space = repository.get_family_space(connection)
        if family_space is None or family_space["id"] != current_user.family_space_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Family space not found.")
        repository.delete_family_space(connection, current_user.family_space_id)
