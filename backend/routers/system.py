"""System routes — status, config summary, settings, update."""

import platform
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

from backend.models.user import User
from backend.auth.dependencies import get_current_user, require_admin
from backend.config import settings
from backend.services.config_manager import read_config_masked, read_config, write_config
from backend.services.update_checker import check_for_update

router = APIRouter(prefix="/system", tags=["system"])

_start_time = time.time()


@router.get("/status")
async def system_status(_user: User = Depends(get_current_user)):
    return {
        "version": settings.app_version,
        "mode": settings.mode,
        "uptime_seconds": int(time.time() - _start_time),
        "hostname": platform.node(),
        "python_version": platform.python_version(),
        "bck_manager_path": settings.bck_manager_path,
    }


@router.get("/config")
async def system_config(_user: User = Depends(get_current_user)):
    """Return the full BCK Manager config with secrets masked."""
    return read_config_masked()


class SettingsUpdate(BaseModel):
    temp_dir: Optional[str] = None
    log_file: Optional[str] = None
    compression: Optional[str] = None
    max_concurrent_uploads: Optional[int] = None


@router.put("/settings")
async def update_settings(
    body: SettingsUpdate,
    _admin: User = Depends(require_admin),
):
    config = read_config()
    s = config.setdefault("settings", {})
    if body.temp_dir is not None:
        s["temp_dir"] = body.temp_dir
    if body.log_file is not None:
        s["log_file"] = body.log_file
    if body.compression is not None:
        s["compression"] = body.compression
    if body.max_concurrent_uploads is not None:
        s["max_concurrent_uploads"] = body.max_concurrent_uploads
    config["settings"] = s
    write_config(config)
    return {"message": "Settings updated", "settings": s}


@router.get("/update/check")
async def update_check(_user: User = Depends(get_current_user)):
    info = await check_for_update()
    if info is None:
        return {"available": False, "current": settings.app_version}
    return {"available": True, **info}


@router.post("/update/apply")
async def update_apply(_admin: User = Depends(require_admin)):
    """Placeholder — in production this would run the update script via SSE."""
    raise HTTPException(
        status.HTTP_501_NOT_IMPLEMENTED,
        "Self-update is only available on deployed servers",
    )
