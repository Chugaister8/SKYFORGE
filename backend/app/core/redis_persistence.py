"""
Redis-backed persistence for in-memory simulation state.
Rooms and swarm sessions survive backend restarts.
"""
import json
import structlog
from app.core.redis_client import get_redis

logger = structlog.get_logger()

_ROOM_PREFIX  = "skyforge:rooms:"
_SWARM_PREFIX = "skyforge:swarm:"
_ROOM_TTL     = 3600 * 6   # 6h
_SWARM_TTL    = 3600 * 2   # 2h


# ── Rooms ─────────────────────────────────────────────────────────

async def save_room_meta(room_id: str, meta: dict) -> None:
    """Persist room metadata (without WS connections)."""
    try:
        redis = await get_redis()
        await redis.setex(f"{_ROOM_PREFIX}{room_id}", _ROOM_TTL, json.dumps(meta))
    except Exception as e:
        logger.warning("redis.room.save_failed", room_id=room_id, error=str(e))


async def load_room_meta(room_id: str) -> dict | None:
    try:
        redis = await get_redis()
        raw = await redis.get(f"{_ROOM_PREFIX}{room_id}")
        return json.loads(raw) if raw else None
    except Exception as e:
        logger.warning("redis.room.load_failed", room_id=room_id, error=str(e))
        return None


async def delete_room_meta(room_id: str) -> None:
    try:
        redis = await get_redis()
        await redis.delete(f"{_ROOM_PREFIX}{room_id}")
    except Exception:
        pass


async def list_room_ids() -> list[str]:
    try:
        redis = await get_redis()
        keys  = await redis.keys(f"{_ROOM_PREFIX}*")
        return [k.replace(_ROOM_PREFIX, "") for k in keys]
    except Exception:
        return []


# ── Swarm sessions ────────────────────────────────────────────────

async def save_swarm_state(session_id: str, state: dict) -> None:
    try:
        redis = await get_redis()
        await redis.setex(f"{_SWARM_PREFIX}{session_id}", _SWARM_TTL, json.dumps(state))
    except Exception as e:
        logger.warning("redis.swarm.save_failed", session_id=session_id, error=str(e))


async def load_swarm_state(session_id: str) -> dict | None:
    try:
        redis = await get_redis()
        raw = await redis.get(f"{_SWARM_PREFIX}{session_id}")
        return json.loads(raw) if raw else None
    except Exception:
        return None


async def delete_swarm_state(session_id: str) -> None:
    try:
        redis = await get_redis()
        await redis.delete(f"{_SWARM_PREFIX}{session_id}")
    except Exception:
        pass
