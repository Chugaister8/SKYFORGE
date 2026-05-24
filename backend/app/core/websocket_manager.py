import json
import structlog
from fastapi import WebSocket

logger = structlog.get_logger()

class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str) -> None:
        await websocket.accept()
        self._connections.setdefault(user_id, set()).add(websocket)
        logger.info("ws.connected", user_id=user_id, total=self.total)

    def disconnect(self, websocket: WebSocket, user_id: str) -> None:
        conns = self._connections.get(user_id, set())
        conns.discard(websocket)
        if not conns:
            self._connections.pop(user_id, None)
        logger.info("ws.disconnected", user_id=user_id, total=self.total)

    async def send_to_user(self, user_id: str, data: dict) -> None:
        conns = self._connections.get(user_id, set())
        dead: set[WebSocket] = set()
        for ws in conns:
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                dead.add(ws)
        for ws in dead:
            conns.discard(ws)

    @property
    def total(self) -> int:
        return sum(len(c) for c in self._connections.values())

ws_manager = ConnectionManager()
