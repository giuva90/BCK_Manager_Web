"""Web terminal routes — WebSocket to SSH PTY bridge."""

import json

from fastapi import APIRouter, Depends, Query, WebSocket
from sqlmodel import Session, select

from backend.database import get_session
from backend.models.user import User
from backend.models.server import Server
from backend.auth.jwt import decode_token
from backend.services.terminal_manager import open_terminal_session

router = APIRouter(prefix="/terminal", tags=["terminal"])


@router.websocket("/connect")
async def terminal_connect(
    websocket: WebSocket,
    server_id: int = Query(...),
    system_user: str = Query(...),
    session: Session = Depends(get_session),
):
    # --- Authentication ---
    token = websocket.cookies.get("access_token")
    if not token:
        await websocket.close(code=4001, reason="Not authenticated")
        return

    payload = decode_token(token)
    if payload is None:
        await websocket.close(code=4001, reason="Invalid token")
        return

    # Only admin and operator can use terminal
    role = payload.get("role", "")
    if role not in ("admin", "operator"):
        await websocket.close(code=4003, reason="Insufficient permissions")
        return

    username = payload.get("sub", "")
    user = session.exec(select(User).where(User.username == username)).first()
    if user is None or not user.is_active:
        await websocket.close(code=4001, reason="User not found")
        return

    # --- Server lookup ---
    server = session.get(Server, server_id)
    if server is None:
        await websocket.close(code=4004, reason="Server not found")
        return

    # --- Double gate security ---

    # Gate 1: user.allowed_system_users
    allowed_users = json.loads(user.allowed_system_users)
    if system_user not in allowed_users:
        await websocket.close(
            code=4003,
            reason=f"User '{username}' not allowed to use system account '{system_user}'",
        )
        return

    # Gate 2: server.terminal_users
    terminal_users = json.loads(server.terminal_users)
    if system_user not in terminal_users:
        await websocket.close(
            code=4003,
            reason=f"System account '{system_user}' not available on server '{server.name}'",
        )
        return

    # --- Open terminal session ---
    await open_terminal_session(websocket, server, system_user)
