"""
Multiplayer room REST API + WebSocket handler.
Secure: token in first WS message, not URL.
"""
import json
import time
import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends, Request
from pydantic import BaseModel, field_validator
from app.api.auth import get_current_user
from app.models.user import User
from app.core.security import decode_token
from app.core.room_manager import room_manager, RoomRole, RoomState
from app.core.rate_limiter import limiter
from app.core.config import get_settings
import uuid

logger   = structlog.get_logger()
router   = APIRouter()
settings = get_settings()


# ── Schemas ───────────────────────────────────────────────────────

class CreateRoomRequest(BaseModel):
    name:       str
    max_size:   int  = 8
    mission_id: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not 2 <= len(v) <= 48:
            raise ValueError("Room name must be 2–48 characters")
        return v

    @field_validator("max_size")
    @classmethod
    def validate_size(cls, v: int) -> int:
        if not 2 <= v <= 16:
            raise ValueError("Room size must be 2–16")
        return v


# ── REST ──────────────────────────────────────────────────────────

@router.get("/")
async def list_rooms(current_user: User = Depends(get_current_user)):
    rooms = room_manager.list_rooms()
    return {"rooms": [r.to_dict() for r in rooms], "count": len(rooms)}


@router.post("/")
@limiter.limit("20/minute")
async def create_room(
    request: Request,
    payload: CreateRoomRequest,
    current_user: User = Depends(get_current_user),
):
    room_id = str(uuid.uuid4())[:8].upper()
    try:
        room = await room_manager.create_room(
            room_id  = room_id,
            name     = payload.name,
            host_id  = current_user.id,
            max_size = payload.max_size,
        )
    except RuntimeError as e:
        raise HTTPException(503, str(e))

    if payload.mission_id:
        room.mission_id = payload.mission_id
    return {"room_id": room_id, "room": room.to_dict()}


@router.get("/{room_id}")
async def get_room(room_id: str, current_user: User = Depends(get_current_user)):
    room = room_manager.get_room(room_id.upper())
    if not room:
        raise HTTPException(404, f"Room '{room_id}' not found")
    return room.to_dict()


@router.delete("/{room_id}")
async def close_room(room_id: str, current_user: User = Depends(get_current_user)):
    room = room_manager.get_room(room_id.upper())
    if not room:
        raise HTTPException(404, "Room not found")
    if room.host_id != current_user.id:
        raise HTTPException(403, "Only host can close room")
    await room_manager.set_state(room_id.upper(), RoomState.CLOSED)
    await room_manager.close_room(room_id.upper())
    return {"closed": room_id}


# ── WebSocket ─────────────────────────────────────────────────────

async def _auth_room_ws(websocket: WebSocket) -> tuple[str, str] | None:
    """
    Returns (user_id, username) or None on auth failure.
    Token passed in first message.
    """
    await websocket.accept()
    try:
        raw     = await __import__("asyncio").wait_for(websocket.receive_text(), timeout=10.0)
        msg     = json.loads(raw)
        if msg.get("type") != "auth":
            await websocket.send_text(json.dumps({"type":"error","msg":"First message must be auth"}))
            await websocket.close(code=4001); return None

        payload  = decode_token(msg.get("token",""))
        if payload.get("type") != "access":
            await websocket.close(code=4001); return None

        return payload["sub"], payload.get("username", payload["sub"][:8])
    except Exception:
        try: await websocket.close(code=4001)
        except Exception: pass
        return None


@router.websocket("/{room_id}/ws")
async def room_ws(room_id: str, websocket: WebSocket):
    auth = await _auth_room_ws(websocket)
    if not auth:
        return
    user_id, username = auth
    room_id = room_id.upper()

    room = room_manager.get_room(room_id)
    if not room:
        await websocket.send_text(json.dumps({"type":"error","msg":"Room not found"}))
        await websocket.close(code=4004); return

    room = await room_manager.join(room_id, user_id, username, websocket)
    if not room:
        await websocket.send_text(json.dumps({"type":"error","msg":"Room full or closed"}))
        await websocket.close(); return

    await websocket.send_text(json.dumps({
        "type":     "ROOM_JOINED",
        "room":     room.to_dict(),
        "your_id":  user_id,
        "chat_log": room.chat_log[-50:],
    }))
    logger.info("room.ws.connected", room_id=room_id, user_id=user_id)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except Exception:
                continue

            match msg.get("type",""):
                case "ping":
                    await websocket.send_text(json.dumps({"type":"pong"}))

                case "CHAT":
                    text = str(msg.get("text",""))[:500].strip()
                    if text:
                        await room_manager.add_chat(room_id, user_id, username, text)

                case "POSITION":
                    pos = msg.get("position",{})
                    if isinstance(pos, dict):
                        await room_manager.update_position(room_id, user_id, pos)

                case "READY":
                    r = room_manager.get_room(room_id)
                    if r:
                        async with r._lock:
                            if user_id in r.members:
                                r.members[user_id].ready = bool(msg.get("ready", True))
                        all_ready = all(m.ready for m in r.members.values())
                        await room_manager.broadcast(room_id, {
                            "type":      "READY_UPDATE",
                            "user_id":   user_id,
                            "ready":     msg.get("ready", True),
                            "all_ready": all_ready,
                            "room":      r.to_dict(),
                        })

                case "START_MISSION":
                    r = room_manager.get_room(room_id)
                    if r and user_id == r.host_id:
                        await room_manager.set_state(room_id, RoomState.ACTIVE)
                        await room_manager.broadcast(room_id, {
                            "type":       "MISSION_STARTED",
                            "mission_id": r.mission_id,
                        })

                case "END_MISSION":
                    r = room_manager.get_room(room_id)
                    if r and user_id == r.host_id:
                        await room_manager.set_state(room_id, RoomState.DEBRIEF)

                case "MISSION_EVENT":
                    await room_manager.broadcast(room_id, {
                        "type":    "MISSION_EVENT",
                        "user_id": user_id,
                        "event":   msg.get("event", {}),
                    }, exclude=user_id)

                case "SET_ROLE":
                    r = room_manager.get_room(room_id)
                    if r and user_id == r.host_id:
                        target   = msg.get("target_user_id")
                        new_role = msg.get("role","PILOT")
                        if target and target in r.members:
                            async with r._lock:
                                r.members[target].role = RoomRole(new_role)
                            await room_manager.broadcast(room_id, {
                                "type":    "ROLE_CHANGED",
                                "user_id": target,
                                "role":    new_role,
                                "room":    r.to_dict(),
                            })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error("room.ws.error", room_id=room_id, user_id=user_id, error=str(e))
    finally:
        await room_manager.leave(room_id, user_id)
        logger.info("room.ws.disconnected", room_id=room_id, user_id=user_id)
