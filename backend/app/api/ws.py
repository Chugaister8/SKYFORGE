import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.core.websocket_manager import ws_manager
from app.core.security import decode_token

logger = structlog.get_logger()
router = APIRouter()

@router.websocket("/ws/telemetry")
async def telemetry_ws(websocket: WebSocket, token: str = Query(...)):
    try:
        payload = decode_token(token)
        user_id = payload["sub"]
        if payload.get("type") != "access":
            await websocket.close(code=4001)
            return
    except Exception:
        await websocket.close(code=4001)
        return

    await ws_manager.connect(websocket, user_id)
    logger.info("ws.connected", user_id=user_id)

    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id)
        logger.info("ws.disconnected", user_id=user_id)
    except Exception as e:
        logger.error("ws.error", user_id=user_id, error=str(e))
        ws_manager.disconnect(websocket, user_id)
