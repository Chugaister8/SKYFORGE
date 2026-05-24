import asyncio
import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.database import engine, Base
from app.core.redis_client import get_redis, close_redis
from app.api.health  import router as health_router
from app.api.auth    import router as auth_router
from app.api.fleet   import router as fleet_router
from app.api.library import router as library_router
from app.api.ws      import router as ws_router
from app.simulation.telemetry_broadcaster import start_telemetry_broadcaster

logger   = structlog.get_logger()
settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("skyforge.startup", version=settings.app_version)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("skyforge.db.ready")
    await get_redis()
    logger.info("skyforge.redis.ready")
    from app.library.loader import load_library
    load_library()
    broadcaster = asyncio.create_task(start_telemetry_broadcaster(interval=1.0))
    logger.info("skyforge.broadcaster.ready")
    yield
    broadcaster.cancel()
    await close_redis()
    await engine.dispose()
    logger.info("skyforge.shutdown")

app = FastAPI(title=settings.app_name, version=settings.app_version, docs_url="/api/docs", redoc_url=None, lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(health_router,  prefix="/api",         tags=["system"])
app.include_router(auth_router,    prefix="/api/auth",    tags=["auth"])
app.include_router(fleet_router,   prefix="/api/fleet",   tags=["fleet"])
app.include_router(library_router, prefix="/api/library", tags=["library"])
app.include_router(ws_router,                             tags=["websocket"])
