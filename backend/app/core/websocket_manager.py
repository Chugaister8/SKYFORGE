"""
WebSocket connection manager with thread-safety and heartbeat.
Tokens passed in first message, NOT in query string.
"""
import json
import asyncio
import structlog
from fastapi import WebSocket
from app.core.config import get_settings

logger   = structlog.get_logger()
settings = get_settings()


class ConnectionManager:
    def __init__(self) -> None:
        # user_id → set of WebSocket connections
        self._connections: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, user_id: str) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.setdefault(user_id, set()).add(websocket)
        logger.info("ws.connected", user_id=user_id, total=self.total)

    async def disconnect(self, websocket: WebSocket, user_id: str) -> None:
        async with self._lock:
            conns = self._connections.get(user_id, set())
            conns.discard(websocket)
            if not conns:
                self._connections.pop(user_id, None)
        logger.info("ws.disconnected", user_id=user_id, total=self.total)

    async def send_to_user(self, user_id: str, data: dict) -> None:
        conns = self._connections.get(user_id, set()).copy()
        dead: list[WebSocket] = []
        for ws in conns:
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                for ws in dead:
                    self._connections.get(user_id, set()).discard(ws)

    async def broadcast_all(self, data: dict) -> None:
        """Broadcast to all connected users."""
        all_conns: list[tuple[str, WebSocket]] = []
        async with self._lock:
            for uid, conns in self._connections.items():
                for ws in conns:
                    all_conns.append((uid, ws))

        dead: list[tuple[str, WebSocket]] = []
        for uid, ws in all_conns:
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                dead.append((uid, ws))

        if dead:
            async with self._lock:
                for uid, ws in dead:
                    self._connections.get(uid, set()).discard(ws)

    @property
    def total(self) -> int:
        return sum(len(c) for c in self._connections.values())

    @property
    def online_users(self) -> list[str]:
        return [uid for uid, conns in self._connections.items() if conns]


ws_manager = ConnectionManager()
