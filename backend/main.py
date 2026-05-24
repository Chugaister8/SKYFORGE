import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.database import engine, Base
from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.api.fleet import router as fleet_router
from app.api.library import router as library_router

logger   = structlog.get_logger()
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("skyforge.startup", version=settings.app_version)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("skyforge.db.ready")
    # Pre-load library cache on startup
    from app.library.loader import load_library
    load_library()
    yield
    logger.info("skyforge.shutdown")
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/api/docs",
    redoc_url=None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router,  prefix="/api",         tags=["system"])
app.include_router(auth_router,    prefix="/api/auth",    tags=["auth"])
app.include_router(fleet_router,   prefix="/api/fleet",   tags=["fleet"])
app.include_router(library_router, prefix="/api/library", tags=["library"])
