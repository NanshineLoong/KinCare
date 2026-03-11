from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.auth import router as auth_router
from app.api.routes.family_space import router as family_space_router
from app.api.routes.health import router as health_router
from app.api.routes.health_records import (
    care_plans_router,
    conditions_router,
    dashboard_router,
    documents_router,
    encounters_router,
    medications_router,
    observations_router,
)
from app.api.routes.members import router as members_router
from app.core.config import Settings, get_settings
from app.core.database import Database


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved_settings = settings or get_settings()
    database = Database(resolved_settings.database_path)
    database.initialize()

    app = FastAPI(title="HomeVital API")
    app.state.settings = resolved_settings
    app.state.database = database
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(resolved_settings.cors_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(family_space_router)
    app.include_router(members_router)
    app.include_router(dashboard_router)
    app.include_router(observations_router)
    app.include_router(conditions_router)
    app.include_router(medications_router)
    app.include_router(encounters_router)
    app.include_router(documents_router)
    app.include_router(care_plans_router)
    return app


app = create_app()
