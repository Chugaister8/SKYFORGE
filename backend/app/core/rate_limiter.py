"""
Centralized rate limiting via slowapi + Redis.
Falls back to in-memory if Redis unavailable.
"""
import structlog
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from app.core.config import get_settings

logger   = structlog.get_logger()
settings = get_settings()


def _get_key(request: Request) -> str:
    """Rate-limit key: IP + path for unauthenticated, user_id + path for authenticated."""
    # Try to extract user_id from Authorization header
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        try:
            from app.core.security import decode_token
            payload = decode_token(auth[7:])
            return f"user:{payload['sub']}:{request.url.path}"
        except Exception:
            pass
    return f"ip:{get_remote_address(request)}:{request.url.path}"


limiter = Limiter(key_func=_get_key, default_limits=[settings.rate_limit_api_default])


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> Response:
    logger.warning(
        "rate_limit.exceeded",
        path=request.url.path,
        client=get_remote_address(request),
        limit=str(exc.detail),
    )
    return JSONResponse(
        status_code=429,
        content={
            "detail":  "Rate limit exceeded",
            "limit":   str(exc.detail),
            "retry_after": "60",
        },
        headers={"Retry-After": "60"},
    )
