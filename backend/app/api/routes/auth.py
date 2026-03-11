from __future__ import annotations

from fastapi import APIRouter, Depends, status

from app.core.config import Settings
from app.core.database import Database
from app.core.dependencies import get_database, get_settings
from app.schemas.auth import AuthResponse, LoginRequest, RefreshRequest, RefreshResponse, RegisterRequest
from app.services.auth import login_user, refresh_tokens, register_user


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
