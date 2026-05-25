"""
Multiplayer room manager.
Rooms are in-memory (Redis persistence — v0.2).
"""
import json
import asyncio
import structlog
from dataclasses import dataclass, field
from fastapi import WebSocket
from enum import Enum

logger = structlog.get_logger()


class RoomRole(str, Enum):
    HOST       = "HOST"
    PILOT      = "PILOT"
    OBSERVER   = "OBSERVER"
    COMMANDER  = "COMMANDER"


class RoomState(str, Enum):
    LOBBY      = "LOBBY"
    BRIEFING   = "BRIEFING"
    ACTIVE     = "ACTIVE"
    DEBRIEF    = "DEBRIEF"
    CLOSED     = "CLOSED"


@dataclass
class RoomMember:
    user_id:  str
    username: str
    role:     RoomRole
    ws:       WebSocket
    ready:    bool  = False
    position: dict  = field(default_factory=lambda: {"lat":48.3794,"lon":31.1656,"alt_m":150})
    status:   str   = "NOMINAL"


@dataclass
class Room:
    id:       str
    name:     str
    host_id:  str
    state:    RoomState            = RoomState.LOBBY
    members:  dict[str, RoomMember] = field(default_factory=dict)
    max_size: int                  = 8
    mission_id: str | None         = None
    chat_log:  list[dict]          = field(default_factory=list)
    events:    list[dict]          = field(default_factory=list)

    def to_dict(self, include_ws: bool = False) -> dict:
        return {
            "id":         self.id,
            "name":       self.name,
            "host_id":    self.host_id,
            "state":      self.state.value,
            "mission_id": self.mission_id,
            "member_count": len(self.members),
            "max_size":   self.max_size,
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


class RoomManager:
    def __init__(self) -> None:
        self._rooms: dict[str, Room] = {}

    # ── Room lifecycle ────────────────────────────────────────────

    def create_room(self, room_id: str, name: str, host_id: str, max_size: int = 8) -> Room:
        room = Room(id=room_id, name=name, host_id=host_id, max_size=max_size)
        self._rooms[room_id] = room
        logger.info("room.created", room_id=room_id, name=name, host=host_id)
        return room

    def get_room(self, room_id: str) -> Room | None:
        return self._rooms.get(room_id)

    def list_rooms(self) -> list[Room]:
        return [r for r in self._rooms.values() if r.state != RoomState.CLOSED]

    def close_room(self, room_id: str) -> None:
        room = self._rooms.get(room_id)
        if room:
            room.state = RoomState.CLOSED
            self._rooms.pop(room_id, None)

    # ── Member management ─────────────────────────────────────────

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
        if len(room.members) >= room.max_size:
            return None

        # Host always gets HOST role
        if user_id == room.host_id:
            role = RoomRole.HOST

        member = RoomMember(user_id=user_id, username=username, role=role, ws=ws)
        room.members[user_id] = member

        await self.broadcast(room_id, {
            "type":     "MEMBER_JOINED",
            "user_id":  user_id,
            "username": username,
            "role":     role.value,
            "room":     room.to_dict(),
        }, exclude=user_id)

        logger.info("room.join", room_id=room_id, user_id=user_id)
        return room

    async def leave(self, room_id: str, user_id: str) -> None:
        room = self._rooms.get(room_id)
        if not room:
            return
        room.members.pop(user_id, None)

        if not room.members:
            self.close_room(room_id)
            return

        # If host left, promote oldest member
        if user_id == room.host_id and room.members:
            new_host = next(iter(room.members.values()))
            room.host_id = new_host.user_id
            new_host.role = RoomRole.HOST

        await self.broadcast(room_id, {
            "type":     "MEMBER_LEFT",
            "user_id":  user_id,
            "room":     room.to_dict(),
        })

    # ── Messaging ────────────────────────────────────────────────

    async def broadcast(
        self,
        room_id: str,
        data:    dict,
        exclude: str | None = None,
    ) -> None:
        room = self._rooms.get(room_id)
        if not room:
            return
        dead: list[str] = []
        for uid, member in room.members.items():
            if uid == exclude:
                continue
            try:
                await member.ws.send_text(json.dumps(data))
            except Exception:
                dead.append(uid)
        for uid in dead:
            room.members.pop(uid, None)

    async def send_to(self, room_id: str, user_id: str, data: dict) -> None:
        room = self._rooms.get(room_id)
        if not room:
            return
        member = room.members.get(user_id)
        if member:
            try:
                await member.ws.send_text(json.dumps(data))
            except Exception:
                room.members.pop(user_id, None)

    # ── State changes ────────────────────────────────────────────

    async def set_state(self, room_id: str, state: RoomState) -> None:
        room = self._rooms.get(room_id)
        if not room:
            return
        room.state = state
        await self.broadcast(room_id, {"type": "ROOM_STATE", "state": state.value})

    async def update_position(
        self, room_id: str, user_id: str, position: dict,
    ) -> None:
        room = self._rooms.get(room_id)
        if not room:
            return
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
        msg = {"user_id": user_id, "username": username, "text": text, "ts": asyncio.get_event_loop().time()}
        room.chat_log.append(msg)
        if len(room.chat_log) > 200:
            room.chat_log = room.chat_log[-200:]
        await self.broadcast(room_id, {"type": "CHAT", **msg})


room_manager = RoomManager()
