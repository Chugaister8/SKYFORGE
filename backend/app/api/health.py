import time
import structlog
from fastapi import APIRouter
from fastapi.responses import JSONResponse

logger = structlog.get_logger()
router = APIRouter()
_start_time = time.time()


@router.get("/health")
async def health():
    """Shallow health check — fast, no DB/Redis queries."""
    return {"status": "ok", "uptime_s": round(time.time() - _start_time, 1)}


@router.get("/health/deep")
async def deep_health():
    """Deep health check — verifies DB and Redis connectivity."""
    checks: dict[str, dict] = {}
    overall = True

    # Database
    try:
        from app.core.database import engine
        async with engine.connect() as conn:
            await conn.execute(__import__("sqlalchemy").text("SELECT 1"))
        checks["database"] = {"status": "ok"}
    except Exception as e:
        checks["database"] = {"status": "error", "detail": str(e)}
        overall = False

    # Redis
    try:
        from app.core.redis_client import get_redis
        redis = await get_redis()
        await redis.ping()
        checks["redis"] = {"status": "ok"}
    except Exception as e:
        checks["redis"] = {"status": "error", "detail": str(e)}
        overall = False

    status_code = 200 if overall else 503
    return JSONResponse(
        status_code=status_code,
        content={
            "status":   "ok" if overall else "degraded",
            "checks":   checks,
            "uptime_s": round(time.time() - _start_time, 1),
        },
    )


@router.get("/verify/{cert_number}")
async def verify_cert_public(cert_number: str):
    """Redirect-style alias for certificate verification."""
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=f"/api/training/verify/{cert_number}")
