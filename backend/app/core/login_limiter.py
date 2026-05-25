"""
Brute-force protection for login endpoint via Redis.
Tracks failed attempts per (IP, username) pair.
"""
import structlog
from datetime import timedelta
from app.core.redis_client import get_redis
from app.core.config import get_settings

logger   = structlog.get_logger()
settings = get_settings()

_MAX_ATTEMPTS = settings.max_login_attempts
_LOCKOUT_S    = settings.lockout_minutes * 60


async def check_login_allowed(ip: str, username: str) -> tuple[bool, int]:
    """
    Returns (allowed, remaining_seconds).
    allowed=False → account is locked out.
    """
    redis = await get_redis()
    lock_key = f"login:lock:{ip}:{username}"
    locked = await redis.get(lock_key)
    if locked:
        ttl = await redis.ttl(lock_key)
        return False, max(ttl, 0)
    return True, 0


async def record_failed_login(ip: str, username: str) -> int:
    """Increment failure counter. Returns current attempt count."""
    redis    = await get_redis()
    fail_key = f"login:fail:{ip}:{username}"
    lock_key = f"login:lock:{ip}:{username}"

    attempts = await redis.incr(fail_key)
    # Set 10-minute window on the counter itself
    await redis.expire(fail_key, 600)

    if attempts >= _MAX_ATTEMPTS:
        await redis.setex(lock_key, _LOCKOUT_S, "1")
        await redis.delete(fail_key)
        logger.warning(
            "login.locked",
            ip=ip, username=username,
            lockout_minutes=settings.lockout_minutes,
        )

    return attempts


async def clear_login_failures(ip: str, username: str) -> None:
    """Clear failure counter on successful login."""
    redis = await get_redis()
    await redis.delete(f"login:fail:{ip}:{username}")
