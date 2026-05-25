"""
WebSocket telemetry endpoint.
Token passed in first message (not query string) to avoid log exposure.
"""
import json
import asyncio
import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.core.websocket_manager import ws_manager
from app.core.security import decode_token
from app.core.config import get_settings

logger   = structlog.get_logger()
router   = APIRouter()
settings = get_settings()


async def _authenticate_ws(websocket: WebSocket) -> str | None:
    """
    Two-phase auth:
    1. Accept connection
    2. Wait up to 10s for {"type":"auth","token":"..."}
    Returns user_id or None on failure.
    """
    await websocket.accept()

    try:
        raw  = await asyncio.wait_for(websocket.receive_text(), timeout=10.0)
        msg  = json.loads(raw)
        if msg.get("type") != "auth":
            await websocket.send_text(json.dumps({"type":"error","msg":"First message must be auth"}))
            await websocket.close(code=4001)
            return None

        token   = msg.get("token","")
        payload = decode_token(token)

        if payload.get("type") != "access":
            await websocket.send_text(json.dumps({"type":"error","msg":"Invalid token type"}))
            await websocket.close(code=4001)
            return None

        return payload["sub"]

    except asyncio.TimeoutError:
        await websocket.send_text(json.dumps({"type":"error","msg":"Auth timeout"}))
        await websocket.close(code=4001)
        return None
    except Exception as exc:
        await websocket.send_text(json.dumps({"type":"error","msg":"Auth failed"}))
        await websocket.close(code=4001)
        return None


@router.websocket("/ws/telemetry")
async def telemetry_ws(websocket: WebSocket):
    user_id = await _authenticate_ws(websocket)
    if not user_id:
        return

    await ws_manager.connect(websocket, user_id)
    await websocket.send_text(json.dumps({"type":"connected","user_id":user_id}))
    logger.info("ws.telemetry.connected", user_id=user_id)

    # Heartbeat task
    heartbeat_interval = settings.ws_heartbeat_s

    async def heartbeat():
        while True:
            await asyncio.sleep(heartbeat_interval)
            try:
                await websocket.send_text(json.dumps({"type":"ping"}))
            except Exception:
                break

    hb_task = asyncio.create_task(heartbeat())

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except Exception:
                continue

            if msg.get("type") == "pong":
                continue  # heartbeat response

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error("ws.telemetry.error", user_id=user_id, error=str(e))
    finally:
        hb_task.cancel()
        await ws_manager.disconnect(websocket, user_id)
        logger.info("ws.telemetry.disconnected", user_id=user_id)
