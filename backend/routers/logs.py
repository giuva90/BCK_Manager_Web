"""Log viewing routes — tail + WebSocket live stream."""

import json
from typing import Optional

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect

from backend.models.user import User
from backend.auth.dependencies import get_current_user
from backend.auth.jwt import decode_token
from backend.services.log_watcher import tail_log, stream_log

router = APIRouter(prefix="/logs", tags=["logs"])


@router.get("/tail")
async def get_tail(
    lines: int = Query(100, ge=1, le=5000),
    server_id: Optional[int] = Query(None),
    _user: User = Depends(get_current_user),
):
    log_lines = await tail_log(lines)
    return {"lines": log_lines, "count": len(log_lines)}


@router.websocket("/stream")
async def ws_stream(websocket: WebSocket):
    # Authenticate via cookie
    token = websocket.cookies.get("access_token")
    if not token:
        await websocket.close(code=4001, reason="Not authenticated")
        return
    payload = decode_token(token)
    if payload is None:
        await websocket.close(code=4001, reason="Invalid token")
        return

    await websocket.accept()
    try:
        async for line in stream_log():
            await websocket.send_text(json.dumps({"type": "log_line", "data": line}))
    except WebSocketDisconnect:
        pass
    except Exception:
        try:
            await websocket.close()
        except Exception:
            pass
