"""
Multiplayer room manager — thread-safe, Redis-persisted metadata.
"""
import json
import asyncio
import structlog
from dataclasses import dataclass, field
from fastapi import WebSocket
from enum import Enum
from app.core import redis_persistence as rp

logger = structlog.get_logger()


class RoomRole(str, Enum):
    HOST      = "HOST"
    PILOT     = "PILOT"
    OBSERVER  = "OBSERVER"
    COMMANDER = "COMMANDER"


class RoomState(str, Enum):
    LOBBY    = "LOBBY"
    BRIEFING = "BRIEFING"
    ACTIVE   = "ACTIVE"
    DEBRIEF  = "DEBRIEF"
    CLOSED   = "CLOSED"


@dataclass
class RoomMember:
    user_id:  str
    username: str
    role:     RoomRole
    ws:       WebSocket
    ready:    bool  = False
    position: dict  = field(default_factory=lambda: {"lat": 48.38, "lon": 31.16, "alt_m": 150})
    status:   str   = "NOMINAL"


@dataclass
class Room:
    id:         str
    name:       str
    host_id:    str
    state:      RoomState              = RoomState.LOBBY
    members:    dict[str, RoomMember]  = field(default_factory=dict)
    max_size:   int                    = 8
    mission_id: str | None             = None
    chat_log:   list[dict]             = field(default_factory=list)
    _lock:      asyncio.Lock           = field(default_factory=asyncio.Lock, repr=False)

    def to_dict(self) -> dict:
        return {
            "id":           self.id,
            "name":         self.name,
            "host_id":      self.host_id,
            "state":        self.state.value,
            "mission_id":   self.mission_id,
            "member_count": len(self.members),
            "max_size":     self.max_size,
            "members": [
                {
                    "user_id":  m.user_id,
                    "username": m.username,
                    "role":     m.role.value,
                    "ready":    m.ready,
                    "position": m.position,
                    "status":   m.status,
                }
                for m in self.members.values()
            ],
        }

    def meta_dict(self) -> dict:
        """Serializable dict for Redis (no WebSocket objects)."""
        d = self.to_dict()
        d["members"] = []  # connections can't be persisted
        return d


class RoomManager:
    def __init__(self) -> None:
        self._rooms: dict[str, Room] = {}
        self._global_lock = asyncio.Lock()

    # ── Lifecycle ─────────────────────────────────────────────────

    async def create_room(
        self, room_id: str, name: str, host_id: str, max_size: int = 8
    ) -> Room:
        async with self._global_lock:
            if len(self._rooms) >= 100:
                raise RuntimeError("Maximum concurrent rooms reached")
            room = Room(id=room_id, name=name, host_id=host_id, max_size=max_size)
            self._rooms[room_id] = room

        await rp.save_room_meta(room_id, room.meta_dict())
        logger.info("room.created", room_id=room_id, name=name, host=host_id)
        return room

    def get_room(self, room_id: str) -> Room | None:
        return self._rooms.get(room_id)

    def list_rooms(self) -> list[Room]:
        return [r for r in self._rooms.values() if r.state != RoomState.CLOSED]

    async def close_room(self, room_id: str) -> None:
        async with self._global_lock:
            self._rooms.pop(room_id, None)
        await rp.delete_room_meta(room_id)

    # ── Members ───────────────────────────────────────────────────

    async def join(
        self,
        room_id:  str,
        user_id:  str,
        username: str,
        ws:       WebSocket,
        role:     RoomRole = RoomRole.PILOT,
    ) -> Room | None:
        room = self._rooms.get(room_id)
        if not room or room.state == RoomState.CLOSED:
            return None

        async with room._lock:
            if len(room.members) >= room.max_size:
                return None
            if user_id == room.host_id:
                role = RoomRole.HOST
            room.members[user_id] = RoomMember(
                user_id=user_id, username=username, role=role, ws=ws
            )

        await self.broadcast(room_id, {
            "type":     "MEMBER_JOINED",
            "user_id":  user_id,
            "username": username,
            "role":     role.value,
            "room":     room.to_dict(),
        }, exclude=user_id)

        await rp.save_room_meta(room_id, room.meta_dict())
        logger.info("room.join", room_id=room_id, user_id=user_id)
        return room

    async def leave(self, room_id: str, user_id: str) -> None:
        room = self._rooms.get(room_id)
        if not room:
            return

        async with room._lock:
            room.members.pop(user_id, None)

            if not room.members:
                await self.close_room(room_id)
                return

            if user_id == room.host_id and room.members:
                new_host = next(iter(room.members.values()))
                room.host_id       = new_host.user_id
                new_host.role      = RoomRole.HOST

        await self.broadcast(room_id, {
            "type":    "MEMBER_LEFT",
            "user_id": user_id,
            "room":    room.to_dict(),
        })
        await rp.save_room_meta(room_id, room.meta_dict())

    # ── Messaging ─────────────────────────────────────────────────

    async def broadcast(
        self,
        room_id: str,
        data:    dict,
        exclude: str | None = None,
    ) -> None:
        # Refresh Redis TTL on activity
        room = self._rooms.get(room_id)
        if room:
            try:
                import asyncio
                asyncio.create_task(rp.save_room_meta(room_id, room.meta_dict()))
            except Exception:
                pass
        room = self._rooms.get(room_id)
        if not room:
            return

        # Snapshot members to avoid mutation during iteration
        async with room._lock:
            snapshot = list(room.members.items())

        dead: list[str] = []
        for uid, member in snapshot:
            if uid == exclude:
                continue
            try:
                await member.ws.send_text(json.dumps(data))
            except Exception:
                dead.append(uid)

        if dead:
            async with room._lock:
                for uid in dead:
                    room.members.pop(uid, None)

    async def send_to(self, room_id: str, user_id: str, data: dict) -> None:
        room = self._rooms.get(room_id)
        if not room:
            return
        async with room._lock:
            member = room.members.get(user_id)
        if member:
            try:
                await member.ws.send_text(json.dumps(data))
            except Exception:
                async with room._lock:
                    room.members.pop(user_id, None)

    async def set_state(self, room_id: str, state: RoomState) -> None:
        room = self._rooms.get(room_id)
        if not room:
            return
        room.state = state
        await rp.save_room_meta(room_id, room.meta_dict())
        await self.broadcast(room_id, {"type": "ROOM_STATE", "state": state.value})

    async def update_position(self, room_id: str, user_id: str, position: dict) -> None:
        room = self._rooms.get(room_id)
        if not room:
            return
        async with room._lock:
            member = room.members.get(user_id)
            if member:
                member.position = position
        await self.broadcast(room_id, {
            "type":     "POSITION_UPDATE",
            "user_id":  user_id,
            "position": position,
        }, exclude=user_id)

    async def add_chat(self, room_id: str, user_id: str, username: str, text: str) -> None:
        room = self._rooms.get(room_id)
        if not room:
            return
        import time
        msg = {"user_id": user_id, "username": username, "text": text, "ts": time.time()}
        async with room._lock:
            room.chat_log.append(msg)
            if len(room.chat_log) > 200:
                room.chat_log = room.chat_log[-200:]
        await self.broadcast(room_id, {"type": "CHAT", **msg})


room_manager = RoomManager()
