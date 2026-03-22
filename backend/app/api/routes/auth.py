from __future__ import annotations

from fastapi import APIRouter, Depends, status

from app.core.config import Settings
from app.core.database import Database
from app.core.dependencies import CurrentUser, get_current_user, get_database, get_settings
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    RefreshRequest,
    RefreshResponse,
    RegisterRequest,
    UserPreferencesRead,
    UserPreferencesUpdate,
)
from app.services.auth import login_user, refresh_tokens, register_user, update_user_preferences


router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(
    request: RegisterRequest,
    database: Database = Depends(get_database),
    settings: Settings = Depends(get_settings),
) -> dict[str, object]:
    return register_user(request, database, settings)


@router.post("/login", response_model=AuthResponse)
def login(
    request: LoginRequest,
    database: Database = Depends(get_database),
    settings: Settings = Depends(get_settings),
) -> dict[str, object]:
    return login_user(request, database, settings)


@router.post("/refresh", response_model=RefreshResponse)
def refresh(
    request: RefreshRequest,
    database: Database = Depends(get_database),
    settings: Settings = Depends(get_settings),
) -> dict[str, str]:
    return refresh_tokens(request, database, settings)


@router.put("/preferences", response_model=UserPreferencesRead)
def update_preferences(
    request: UserPreferencesUpdate,
    database: Database = Depends(get_database),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, str | None]:
    return update_user_preferences(current_user, request, database)
