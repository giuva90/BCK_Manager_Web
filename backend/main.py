"""FastAPI application factory — entry point for BCK Manager Web."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.config import settings
from backend.database import init_db

logger = logging.getLogger("bck_web")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown logic."""
    # --- Startup ---
    init_db()
    logger.info(f"BCK Manager Web v{settings.app_version} starting (mode={settings.mode})")

    # Check if first-run (no users)
    from sqlmodel import Session, select, func
    from backend.database import engine
    from backend.models.user import User

    with Session(engine) as session:
        count = session.exec(select(func.count()).select_from(User)).one()
        if count == 0:
            logger.info("[SETUP] No users found. Visit https://<host>/setup to create the first admin.")

    yield

    # --- Shutdown ---
    logger.info("BCK Manager Web shutting down")


def create_app() -> FastAPI:
    app = FastAPI(
        title="BCK Manager Web",
        version=settings.app_version,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    # CORS — allow frontend dev server in development
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # --- Register API routers ---
    from backend.routers import auth, setup, users, jobs, run, storage
    from backend.routers import filesystem, restore, retention, cron, logs
    from backend.routers import system, fleet, terminal

    prefix = "/api/v1"
    app.include_router(auth.router, prefix=prefix)
    app.include_router(setup.router, prefix=prefix)
    app.include_router(users.router, prefix=prefix)
    app.include_router(jobs.router, prefix=prefix)
    app.include_router(run.router, prefix=prefix)
    app.include_router(storage.router, prefix=prefix)
    app.include_router(filesystem.router, prefix=prefix)
    app.include_router(restore.router, prefix=prefix)
    app.include_router(retention.router, prefix=prefix)
    app.include_router(cron.router, prefix=prefix)
    app.include_router(logs.router, prefix=prefix)
    app.include_router(system.router, prefix=prefix)
    app.include_router(fleet.router, prefix=prefix)
    app.include_router(terminal.router, prefix=prefix)

    # --- Serve frontend static files (production) ---
    import os
    static_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
    if os.path.isdir(static_dir):
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")

    return app


app = create_app()
