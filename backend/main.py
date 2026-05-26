import asyncio
import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import get_settings
from app.core.database import engine, Base
from app.core.redis_client import get_redis, close_redis
from app.core.rate_limiter import limiter, rate_limit_exceeded_handler
from app.core.logging import configure_logging, RequestLoggingMiddleware

from app.api.health     import router as health_router
from app.api.auth       import router as auth_router
from app.api.fleet      import router as fleet_router
from app.api.library    import router as library_router
from app.api.ws         import router as ws_router
from app.api.simulation import router as sim_router
from app.api.ew         import router as ew_router
from app.api.sam        import router as sam_router
from app.api.weather    import router as weather_router
from app.api.missions   import router as missions_router
from app.api.swarm      import router as swarm_router
from app.api.training   import router as training_router
from app.api.scenarios  import router as scenarios_router
from app.api.engineer   import router as engineer_router
from app.api.rooms      import router as rooms_router
from app.api.ws_simulator import router as ws_sim_router
from app.api.push        import router as push_router
from app.simulation.telemetry_broadcaster import start_telemetry_broadcaster

# Configure structured logging before anything else
configure_logging()
logger   = structlog.get_logger()
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "skyforge.startup",
        version     = settings.app_version,
        environment = settings.environment,
        debug       = settings.debug,
    )
    async with engine.begin() as conn:
        if not settings.is_production:
            await conn.run_sync(Base.metadata.create_all)
    await get_redis()
    from app.library.loader import load_library
    load_library()
    broadcaster = asyncio.create_task(start_telemetry_broadcaster(interval=1.0))
    logger.info("skyforge.ready")
    yield
    broadcaster.cancel()
    await close_redis()
    await engine.dispose()
    logger.info("skyforge.shutdown")


app = FastAPI(
    title       = settings.app_name,
    version     = settings.app_version,
    docs_url    = "/api/docs" if not settings.is_production else None,
    redoc_url   = None,
    lifespan    = lifespan,
)

# ── Middleware (order matters — first added = outermost) ──────────

# 1. Request logging (outermost — captures all)
app.add_middleware(RequestLoggingMiddleware)

# 2. CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins     = settings.cors_origins,
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
    expose_headers    = ["X-Request-ID"],
)

# ── Rate limiting ─────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# ── Global error handler ──────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    from app.core.logging import get_request_id
    logger.error(
        "unhandled_exception",
        path       = request.url.path,
        request_id = get_request_id(),
        error      = str(exc),
        exc_info   = exc,
    )
    return JSONResponse(
        status_code = 500,
        content     = {
            "detail":     "Internal server error",
            "request_id": get_request_id(),
        },
    )

# ── Routers ───────────────────────────────────────────────────────
app.include_router(health_router,    prefix="/api",            tags=["system"])
app.include_router(auth_router,      prefix="/api/auth",       tags=["auth"])
app.include_router(fleet_router,     prefix="/api/fleet",      tags=["fleet"])
app.include_router(library_router,   prefix="/api/library",    tags=["library"])
app.include_router(sim_router,       prefix="/api/sim",        tags=["simulation"])
app.include_router(ew_router,        prefix="/api/ew",         tags=["ew"])
app.include_router(sam_router,       prefix="/api/sam",        tags=["sam"])
app.include_router(weather_router,   prefix="/api/weather",    tags=["weather"])
app.include_router(missions_router,  prefix="/api/missions",   tags=["missions"])
app.include_router(swarm_router,     prefix="/api/swarm",      tags=["swarm"])
app.include_router(training_router,  prefix="/api/training",   tags=["training"])
app.include_router(scenarios_router, prefix="/api/scenarios",  tags=["scenarios"])
app.include_router(engineer_router,  prefix="/api/engineer",   tags=["engineer"])
app.include_router(rooms_router,     prefix="/api/rooms",      tags=["rooms"])
app.include_router(ws_router,                                  tags=["websocket"])
app.include_router(ws_sim_router,                              tags=["websocket"])
app.include_router(push_router,      prefix="/api/push",       tags=["push"])
