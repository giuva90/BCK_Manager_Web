"""Web terminal session lifecycle — SSH-backed PTY sessions for xterm.js."""

import json
import logging

from fastapi import WebSocket

from backend.models.server import Server

logger = logging.getLogger("terminal_manager")


async def open_terminal_session(
    websocket: WebSocket,
    server: Server,
    system_user: str,
) -> None:
    """Bridge a WebSocket to an SSH PTY session."""
    import asyncssh
    import asyncio

    await websocket.accept()
    try:
        async with asyncssh.connect(
            server.ssh_host,
            port=server.ssh_port,
            username=system_user,
            client_keys=[server.ssh_key_path] if server.ssh_key_path else [],
            known_hosts=None,
            request_pty=True,
            term_type="xterm-256color",
        ) as conn:
            async with conn.create_process("bash -l") as process:
                await _bridge(websocket, process)
    except asyncssh.PermissionDenied:
        await websocket.close(code=4003, reason="SSH permission denied")
    except Exception as e:
        logger.error(f"Terminal error: {e}")
        try:
            await websocket.close(code=4000, reason=str(e)[:120])
        except Exception:
            pass


async def _bridge(websocket: WebSocket, process) -> None:
    import asyncio

    async def ws_to_ssh():
        try:
            while True:
                data = await websocket.receive_text()
                msg = json.loads(data)
                if msg["type"] == "input":
                    process.stdin.write(msg["data"])
                elif msg["type"] == "resize":
                    process.change_terminal_size(msg["cols"], msg["rows"])
        except Exception:
            pass

    async def ssh_to_ws():
        try:
            while True:
                data = await process.stdout.read(1024)
                if not data:
                    break
                await websocket.send_text(
                    json.dumps({"type": "output", "data": data})
                )
        except Exception:
            pass

    await asyncio.gather(ws_to_ssh(), ssh_to_ws())
