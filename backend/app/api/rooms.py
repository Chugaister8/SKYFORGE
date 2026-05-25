"""
Multiplayer room REST API + WebSocket handler.
"""
import json
import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException, Depends
from pydantic import BaseModel
from app.api.auth import get_current_user
from app.models.user import User
from app.core.security import decode_token
from app.core.room_manager import room_manager, RoomRole, RoomState
import uuid

logger = structlog.get_logger()
router = APIRouter()


# ── REST ──────────────────────────────────────────────────────────

class CreateRoomRequest(BaseModel):
    name:       str
    max_size:   int   = 8
    mission_id: str | None = None


@router.get("/")
async def list_rooms(current_user: User = Depends(get_current_user)):
    rooms = room_manager.list_rooms()
    return {
        "rooms": [r.to_dict() for r in rooms],
        "count": len(rooms),
    }


@router.post("/")
async def create_room(
    payload: CreateRoomRequest,
    current_user: User = Depends(get_current_user),
):
    room_id = str(uuid.uuid4())[:8].upper()
    room = room_manager.create_room(
        room_id  = room_id,
        name     = payload.name,
        host_id  = current_user.id,
        max_size = payload.max_size,
    )
    if payload.mission_id:
        room.mission_id = payload.mission_id
    return {"room_id": room_id, "room": room.to_dict()}


@router.get("/{room_id}")
async def get_room(room_id: str, current_user: User = Depends(get_current_user)):
    room = room_manager.get_room(room_id)
    if not room:
        raise HTTPException(404, f"Room '{room_id}' not found")
    return room.to_dict()


@router.delete("/{room_id}")
async def close_room(room_id: str, current_user: User = Depends(get_current_user)):
    room = room_manager.get_room(room_id)
    if not room:
        raise HTTPException(404, "Room not found")
    if room.host_id != current_user.id:
        raise HTTPException(403, "Only host can close room")
    await room_manager.set_state(room_id, RoomState.CLOSED)
    room_manager.close_room(room_id)
    return {"closed": room_id}


# ── WebSocket ─────────────────────────────────────────────────────

@router.websocket("/{room_id}/ws")
async def room_ws(
    room_id:  str,
    websocket: WebSocket,
    token:    str = Query(...),
):
    # Auth
    try:
        payload = decode_token(token)
        user_id  = payload["sub"]
        username = payload.get("username", user_id[:8])
        if payload.get("type") != "access":
            await websocket.close(code=4001)
            return
    except Exception:
        await websocket.close(code=4001)
        return

    # Room check
    room = room_manager.get_room(room_id)
    if not room:
        await websocket.close(code=4004)
        return

    await websocket.accept()
    room = await room_manager.join(room_id, user_id, username, websocket)
    if not room:
        await websocket.send_text(json.dumps({"type": "ERROR", "msg": "Room full or closed"}))
        await websocket.close(); return

    # Send initial state
    await websocket.send_text(json.dumps({
        "type": "ROOM_JOINED",
        "room": room.to_dict(),
        "your_id": user_id,
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

            msg_type = msg.get("type", "")

            match msg_type:
                case "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))

                case "CHAT":
                    text = str(msg.get("text",""))[:500]
                    if text:
                        await room_manager.add_chat(room_id, user_id, username, text)

                case "POSITION":
                    pos = msg.get("position", {})
                    await room_manager.update_position(room_id, user_id, pos)

                case "READY":
                    r = room_manager.get_room(room_id)
                    if r and user_id in r.members:
                        r.members[user_id].ready = msg.get("ready", True)
                        await room_manager.broadcast(room_id, {
                            "type":    "READY_UPDATE",
                            "user_id": user_id,
                            "ready":   r.members[user_id].ready,
                            "all_ready": all(m.ready for m in r.members.values()),
                        })

                case "START_MISSION":
                    r = room_manager.get_room(room_id)
                    if r and user_id == r.host_id:
                        await room_manager.set_state(room_id, RoomState.ACTIVE)
                        await room_manager.broadcast(room_id, {
                            "type":       "MISSION_STARTED",
                            "mission_id": r.mission_id,
                        })

                case "MISSION_EVENT":
                    # Broadcast game events (threats, hits, waypoints) to all
                    await room_manager.broadcast(room_id, {
                        "type":    "MISSION_EVENT",
                        "user_id": user_id,
                        "event":   msg.get("event", {}),
                    }, exclude=user_id)

                case "END_MISSION":
                    r = room_manager.get_room(room_id)
                    if r and user_id == r.host_id:
                        await room_manager.set_state(room_id, RoomState.DEBRIEF)

                case "SET_ROLE":
                    r = room_manager.get_room(room_id)
                    if r and user_id == r.host_id:
                        target = msg.get("target_user_id")
                        new_role = msg.get("role", "PILOT")
                        if target and target in r.members:
                            r.members[target].role = RoomRole(new_role)
                            await room_manager.broadcast(room_id, {
                                "type": "ROLE_CHANGED",
                                "user_id": target,
                                "role": new_role,
                            })

                case _:
                    logger.debug("room.ws.unknown", type=msg_type)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error("room.ws.error", room_id=room_id, user_id=user_id, error=str(e))
    finally:
        await room_manager.leave(room_id, user_id)
        logger.info("room.ws.disconnected", room_id=room_id, user_id=user_id)
