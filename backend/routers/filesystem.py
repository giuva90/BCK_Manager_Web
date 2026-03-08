"""Filesystem browser — admin only.  Blocks /proc, /sys, /dev."""

import os
import subprocess
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.models.user import User
from backend.auth.dependencies import require_admin

router = APIRouter(prefix="/filesystem", tags=["filesystem"])

_BLOCKED_PREFIXES = ("/proc", "/sys", "/dev")


@router.get("/browse")
async def browse_directory(
    path: str = Query("/"),
    server_id: Optional[int] = Query(None),
    _admin: User = Depends(require_admin),
):
    # Resolve and normalise path
    real = os.path.realpath(path)
    for blocked in _BLOCKED_PREFIXES:
        if real == blocked or real.startswith(blocked + "/"):
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Access to {blocked} is blocked")

    if not os.path.isdir(real):
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Directory not found: {path}")

    entries = []
    try:
        for name in sorted(os.listdir(real)):
            full = os.path.join(real, name)
            is_dir = os.path.isdir(full)
            try:
                stat = os.stat(full)
                size = stat.st_size if not is_dir else None
            except OSError:
                size = None
            entries.append({
                "name": name,
                "path": full,
                "is_directory": is_dir,
                "size": size,
            })
    except PermissionError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Permission denied")

    return {"path": real, "entries": entries}


@router.get("/volumes")
async def list_volumes(
    server_id: Optional[int] = Query(None),
    _admin: User = Depends(require_admin),
):
    """List Docker volumes."""
    try:
        result = subprocess.run(
            ["docker", "volume", "ls", "--format", "json"],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode != 0:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Docker not available")

        volumes = []
        for line in result.stdout.strip().splitlines():
            if line:
                volumes.append(json.loads(line))
        return volumes
    except FileNotFoundError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Docker not installed")


@router.get("/containers")
async def list_containers(
    server_id: Optional[int] = Query(None),
    _admin: User = Depends(require_admin),
):
    """List Docker containers."""
    try:
        result = subprocess.run(
            ["docker", "ps", "-a", "--format", "json"],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode != 0:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Docker not available")

        containers = []
        for line in result.stdout.strip().splitlines():
            if line:
                containers.append(json.loads(line))
        return containers
    except FileNotFoundError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Docker not installed")
