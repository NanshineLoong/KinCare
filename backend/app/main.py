from fastapi import FastAPI

from app.api.routes.auth import router as auth_router
from app.api.routes.health import router as health_router
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
    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(members_router)
    return app


app = create_app()
