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
from backend.services.config_manager import (
    read_config_masked, read_config, write_config,
    get_endpoints, get_endpoint_by_name, add_endpoint, update_endpoint, delete_endpoint,
    get_encryption_keys, get_encryption_key_by_name,
    add_encryption_key, update_encryption_key, delete_encryption_key,
)
from backend.services.bck_bridge import mask_secrets
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


# ---------------------------------------------------------------------------
# S3 Endpoint CRUD
# ---------------------------------------------------------------------------

class EndpointCreate(BaseModel):
    name: str
    endpoint_url: str
    access_key: str
    secret_key: str
    region: str = ""


class EndpointUpdate(BaseModel):
    endpoint_url: Optional[str] = None
    access_key: Optional[str] = None
    secret_key: Optional[str] = None
    region: Optional[str] = None


@router.get("/endpoints")
async def list_endpoints(_user: User = Depends(get_current_user)):
    """List all S3 endpoints from the local config (secrets masked)."""
    return [mask_secrets(ep) for ep in get_endpoints()]


@router.post("/endpoints", status_code=201)
async def create_endpoint(
    body: EndpointCreate,
    _admin: User = Depends(require_admin),
):
    if get_endpoint_by_name(body.name):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Endpoint '{body.name}' already exists")
    ep_dict = body.model_dump()
    add_endpoint(ep_dict)
    return mask_secrets(ep_dict)


@router.put("/endpoints/{name}")
async def update_endpoint_route(
    name: str,
    body: EndpointUpdate,
    _admin: User = Depends(require_admin),
):
    if get_endpoint_by_name(name) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Endpoint '{name}' not found")
    updates = body.model_dump(exclude_none=True)
    try:
        update_endpoint(name, updates)
    except ValueError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))
    updated = get_endpoint_by_name(name)
    return mask_secrets(updated)


@router.delete("/endpoints/{name}", status_code=204)
async def delete_endpoint_route(
    name: str,
    _admin: User = Depends(require_admin),
):
    try:
        delete_endpoint(name)
    except ValueError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))


# ---------------------------------------------------------------------------
# Encryption Key CRUD
# ---------------------------------------------------------------------------

class EncryptionKeyCreate(BaseModel):
    name: str
    passphrase: str


class EncryptionKeyUpdate(BaseModel):
    passphrase: Optional[str] = None


@router.get("/encryption-keys")
async def list_encryption_keys(_user: User = Depends(get_current_user)):
    """List all encryption keys (passphrases masked)."""
    return [mask_secrets(k) for k in get_encryption_keys()]


@router.post("/encryption-keys", status_code=201)
async def create_encryption_key(
    body: EncryptionKeyCreate,
    _admin: User = Depends(require_admin),
):
    if get_encryption_key_by_name(body.name):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Encryption key '{body.name}' already exists")
    key_dict = body.model_dump()
    add_encryption_key(key_dict)
    return mask_secrets(key_dict)


@router.put("/encryption-keys/{name}")
async def update_encryption_key_route(
    name: str,
    body: EncryptionKeyUpdate,
    _admin: User = Depends(require_admin),
):
    if get_encryption_key_by_name(name) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Encryption key '{name}' not found")
    updates = body.model_dump(exclude_none=True)
    try:
        update_encryption_key(name, updates)
    except ValueError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))
    updated = get_encryption_key_by_name(name)
    return mask_secrets(updated)


@router.delete("/encryption-keys/{name}", status_code=204)
async def delete_encryption_key_route(
    name: str,
    _admin: User = Depends(require_admin),
):
    try:
        delete_encryption_key(name)
    except ValueError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))
