"""Hub-side agent WebSocket session management."""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import WebSocket

from backend.schemas.server import AgentMessage

logger = logging.getLogger("agent_hub")


class AgentSession:
    """Represents a single connected agent."""
    def __init__(self, server_id: int, websocket: WebSocket):
        self.server_id = server_id
        self.websocket = websocket
        self.connected_at = datetime.now(timezone.utc)
        self._pending: dict[str, asyncio.Future] = {}

    async def send(self, msg: AgentMessage) -> None:
        await self.websocket.send_text(msg.model_dump_json())

    def resolve(self, msg_id: str, msg: AgentMessage) -> None:
        future = self._pending.pop(msg_id, None)
        if future and not future.done():
            future.set_result(msg)

    async def send_command(self, msg: AgentMessage, timeout: float = 300) -> AgentMessage:
        """Send a command and await the correlated response."""
        future: asyncio.Future = asyncio.get_event_loop().create_future()
        self._pending[msg.id] = future
        await self.send(msg)
        try:
            return await asyncio.wait_for(future, timeout=timeout)
        except asyncio.TimeoutError:
            self._pending.pop(msg.id, None)
            raise


class AgentHub:
    """Registry of currently connected agents.  Thread-safe for async context."""

    def __init__(self):
        self._sessions: dict[int, AgentSession] = {}

    async def register(self, server_id: int, websocket: WebSocket) -> AgentSession:
        session = AgentSession(server_id, websocket)
        self._sessions[server_id] = session
        logger.info(f"Agent registered: server_id={server_id}")
        return session

    async def unregister(self, server_id: int) -> None:
        self._sessions.pop(server_id, None)
        logger.info(f"Agent unregistered: server_id={server_id}")

    async def send_command(self, server_id: int, msg: AgentMessage) -> AgentMessage:
        session = self._sessions.get(server_id)
        if session is None:
            raise RuntimeError(f"Agent {server_id} is not connected")
        return await session.send_command(msg)

    def is_online(self, server_id: int) -> bool:
        return server_id in self._sessions

    def get_session(self, server_id: int) -> Optional[AgentSession]:
        return self._sessions.get(server_id)

    def get_all_status(self) -> list[dict]:
        return [
            {
                "server_id": sid,
                "connected_at": s.connected_at.isoformat(),
            }
            for sid, s in self._sessions.items()
        ]


# Singleton instance
agent_hub = AgentHub()
