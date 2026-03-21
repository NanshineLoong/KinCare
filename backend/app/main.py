from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.ai.orchestrator import ChatOrchestrator
from app.ai.scheduler import KinCareScheduler
from app.api.routes.admin_settings import router as admin_settings_router
from app.api.routes.auth import router as auth_router
from app.api.routes.chat import router as chat_router
from app.api.routes.family_space import router as family_space_router
from app.api.routes.health import router as health_router
from app.api.routes.health_records import (
    care_plans_router,
    conditions_router,
    dashboard_router,
    encounters_router,
    health_summaries_router,
    medications_router,
    observations_router,
    sleep_records_router,
    workout_records_router,
)
from app.api.routes.members import router as members_router
from app.core.config import Settings, get_settings
from app.core.database import Database
from app.services.system_config import load_runtime_settings


def create_app(settings: Settings | None = None) -> FastAPI:
    base_settings = settings or get_settings()
    database = Database(base_settings.database_path)
    database.initialize()
    resolved_settings = load_runtime_settings(database, base_settings)
    scheduler = KinCareScheduler(database, settings=resolved_settings)
    orchestrator = ChatOrchestrator(
        database=database,
        settings=resolved_settings,
        scheduler=scheduler,
    )

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if resolved_settings.scheduler_enabled:
            scheduler.start()
        try:
            yield
        finally:
            scheduler.shutdown()

    app = FastAPI(title="KinCare API", lifespan=lifespan)
    app.state.base_settings = base_settings
    app.state.settings = resolved_settings
    app.state.database = database
    app.state.scheduler = scheduler
    app.state.chat_orchestrator = orchestrator
    database.app = app  # type: ignore[attr-defined]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(resolved_settings.cors_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router)
    app.include_router(admin_settings_router)
    app.include_router(auth_router)
    app.include_router(chat_router)
    app.include_router(family_space_router)
    app.include_router(members_router)
    app.include_router(dashboard_router)
    app.include_router(observations_router)
    app.include_router(conditions_router)
    app.include_router(medications_router)
    app.include_router(encounters_router)
    app.include_router(sleep_records_router)
    app.include_router(workout_records_router)
    app.include_router(health_summaries_router)
    app.include_router(care_plans_router)
    return app


app = create_app()
