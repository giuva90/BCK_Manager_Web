"""Fleet management routes — server CRUD, agent WebSocket, token generation."""

import json
import logging
import secrets
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlmodel import Session, select

from backend.database import get_session
from backend.models.user import User
from backend.models.server import Server
from backend.auth.password import hash_password, verify_password
from backend.auth.dependencies import require_admin, get_current_user
from backend.auth.jwt import decode_token
from backend.schemas.server import ServerCreate, ServerUpdate, ServerRead, AgentMessage, AgentTokenResponse
from backend.services.agent_hub import agent_hub
from backend.services.ssh_client import test_ssh_connection

logger = logging.getLogger("bck_web.fleet")

router = APIRouter(prefix="/fleet", tags=["fleet"])


def _to_read(s: Server) -> ServerRead:
    return ServerRead(
        id=s.id,
        name=s.name,
        hostname=s.hostname,
        connection_type=s.connection_type,
        agent_version=s.agent_version,
        last_seen=s.last_seen,
        ssh_host=s.ssh_host,
        ssh_port=s.ssh_port,
        ssh_user=s.ssh_user,
        is_online=agent_hub.is_online(s.id) if s.connection_type == "agent" else s.is_online,
        bck_manager_version=s.bck_manager_version,
        bck_manager_path=s.bck_manager_path,
        config_path=s.config_path,
        notes=s.notes,
        added_at=s.added_at,
        terminal_users=json.loads(s.terminal_users),
    )


@router.get("/servers", response_model=list[ServerRead])
async def list_servers(
    session: Session = Depends(get_session),
    _user: User = Depends(get_current_user),
):
    servers = session.exec(select(Server)).all()
    return [_to_read(s) for s in servers]


@router.post("/servers", response_model=ServerRead, status_code=201)
async def register_server(
    body: ServerCreate,
    session: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
):
    existing = session.exec(select(Server).where(Server.name == body.name)).first()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Server '{body.name}' already exists")

    server = Server(
        name=body.name,
        hostname=body.hostname,
        connection_type=body.connection_type,
        ssh_host=body.ssh_host,
        ssh_port=body.ssh_port,
        ssh_user=body.ssh_user,
        ssh_key_path=body.ssh_key_path,
        bck_manager_path=body.bck_manager_path,
        config_path=body.config_path,
        notes=body.notes,
        terminal_users=json.dumps(body.terminal_users),
    )
    session.add(server)
    session.commit()
    session.refresh(server)
    logger.info("Server registered: name=%s type=%s", server.name, server.connection_type)
    return _to_read(server)


@router.get("/servers/{server_id}", response_model=ServerRead)
async def get_server(
    server_id: int,
    session: Session = Depends(get_session),
    _user: User = Depends(get_current_user),
):
    server = session.get(Server, server_id)
    if server is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Server not found")
    return _to_read(server)


@router.patch("/servers/{server_id}", response_model=ServerRead)
async def update_server(
    server_id: int,
    body: ServerUpdate,
    session: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
):
    server = session.get(Server, server_id)
    if server is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Server not found")

    for field_name in ("name", "hostname", "ssh_host", "ssh_port", "ssh_user",
                       "ssh_key_path", "bck_manager_path", "config_path", "notes"):
        val = getattr(body, field_name, None)
        if val is not None:
            setattr(server, field_name, val)

    if body.terminal_users is not None:
        server.terminal_users = json.dumps(body.terminal_users)

    session.add(server)
    session.commit()
    session.refresh(server)
    return _to_read(server)


@router.delete("/servers/{server_id}", status_code=204)
async def delete_server(
    server_id: int,
    session: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
):
    server = session.get(Server, server_id)
    if server is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Server not found")
    session.delete(server)
    session.commit()


@router.get("/servers/{server_id}/status")
async def server_status(
    server_id: int,
    session: Session = Depends(get_session),
    _user: User = Depends(get_current_user),
):
    server = session.get(Server, server_id)
    if server is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Server not found")
    online = agent_hub.is_online(server_id) if server.connection_type == "agent" else server.is_online
    return {"server_id": server_id, "online": online, "last_seen": server.last_seen}


@router.post("/servers/{server_id}/test")
async def test_server(
    server_id: int,
    session: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
):
    server = session.get(Server, server_id)
    if server is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Server not found")

    if server.connection_type == "agent":
        ok = agent_hub.is_online(server_id)
        return {"server_id": server_id, "connection_type": "agent", "success": ok}
    else:
        ok = await test_ssh_connection(server)
        return {"server_id": server_id, "connection_type": "ssh", "success": ok}


@router.post("/token/generate", response_model=AgentTokenResponse)
async def generate_agent_token(
    _admin: User = Depends(require_admin),
):
    """Generate a one-time agent registration token."""
    raw_token = secrets.token_urlsafe(48)
    return AgentTokenResponse(
        token=raw_token,
        install_command=f"curl -sSL https://<hub>/install-agent.sh | sudo bash -s -- <HUB_URL> {raw_token}",
    )


@router.websocket("/agent-ws")
async def agent_websocket(
    websocket: WebSocket,
    session: Session = Depends(get_session),
):
    """Agent WebSocket endpoint — agents connect here."""
    # Authenticate via Bearer token in header
    auth_header = websocket.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        logger.warning("Agent WebSocket rejected: missing token")
        await websocket.close(code=4001, reason="Missing agent token")
        return

    token = auth_header[7:]

    # Find server with matching token
    servers = session.exec(select(Server).where(Server.connection_type == "agent")).all()
    server = None
    for s in servers:
        if s.agent_token_hash and verify_password(token, s.agent_token_hash):
            server = s
            break

    if server is None:
        logger.warning("Agent WebSocket rejected: invalid token")
        await websocket.close(code=4003, reason="Invalid agent token")
        return

    await websocket.accept()
    logger.info("Agent connected: server_id=%s name=%s", server.id, server.name)
    agent_session = await agent_hub.register(server.id, websocket)

    # Update server status
    server.is_online = True
    server.last_seen = datetime.now(timezone.utc)
    session.add(server)
    session.commit()

    try:
        while True:
            data = await websocket.receive_text()
            msg = AgentMessage.model_validate_json(data)

            if msg.type == "heartbeat":
                server.last_seen = datetime.now(timezone.utc)
                session.add(server)
                session.commit()
            elif msg.type == "registration":
                server.agent_version = msg.payload.get("agent_version")
                server.bck_manager_version = msg.payload.get("bck_manager_version")
                session.add(server)
                session.commit()
            elif msg.type in ("result", "pong", "log_line", "job_started", "job_finished"):
                # Resolve pending command futures
                agent_session.resolve(msg.id, msg)

    except WebSocketDisconnect:
        logger.info("Agent disconnected: server_id=%s", server.id)
    except Exception as exc:
        logger.error("Agent WebSocket error: server_id=%s error=%s", server.id, exc, exc_info=True)
    finally:
        await agent_hub.unregister(server.id)
        server.is_online = False
        session.add(server)
        session.commit()
