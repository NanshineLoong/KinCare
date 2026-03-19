from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.core.config import Settings
from app.core.database import Database
from app.core.dependencies import CurrentUser, get_database, get_settings, require_admin
from app.schemas.admin_settings import AdminSettingsRead, AdminSettingsUpdate
from app.services.system_config import (
    get_admin_settings,
    load_runtime_settings,
    update_admin_settings,
)


router = APIRouter(prefix="/api/admin/settings", tags=["admin-settings"])


@router.get("", response_model=AdminSettingsRead)
def read_admin_settings(
    request: Request,
    database: Database = Depends(get_database),
    settings: Settings = Depends(get_settings),
    current_user: CurrentUser = Depends(require_admin),
) -> dict[str, object]:
    del current_user
    base_settings = getattr(request.app.state, "base_settings", settings)
    return get_admin_settings(database, base_settings)


@router.put("", response_model=AdminSettingsRead)
def edit_admin_settings(
    payload: AdminSettingsUpdate,
    request: Request,
    database: Database = Depends(get_database),
    settings: Settings = Depends(get_settings),
    current_user: CurrentUser = Depends(require_admin),
) -> dict[str, object]:
    del current_user
    base_settings = getattr(request.app.state, "base_settings", settings)
    result = update_admin_settings(
        database,
        base_settings,
        payload=payload.model_dump(exclude_unset=True),
    )
    runtime_settings = load_runtime_settings(database, base_settings)
    request.app.state.settings = runtime_settings
    request.app.state.chat_orchestrator.update_settings(runtime_settings)
    scheduler = request.app.state.scheduler
    scheduler.update_runtime_settings(runtime_settings)
    scheduler.update_builtin_refresh_schedule(
        health_summary_refresh_time=result["health_summary_refresh_time"],
        care_plan_refresh_time=result["care_plan_refresh_time"],
    )
    return result
