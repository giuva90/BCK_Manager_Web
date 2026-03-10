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


@router.get("/volumes-rich")
async def list_volumes_rich(
    server_id: Optional[int] = Query(None),
    _admin: User = Depends(require_admin),
):
    """List Docker volumes enriched with connected container info."""
    try:
        vol_result = subprocess.run(
            ["docker", "volume", "ls", "--format", "json"],
            capture_output=True, text=True, timeout=10,
        )
        if vol_result.returncode != 0:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Docker not available")

        volumes = []
        for line in vol_result.stdout.strip().splitlines():
            if line:
                volumes.append(json.loads(line))

        # Also fetch containers to find which volumes they use
        con_result = subprocess.run(
            ["docker", "ps", "-a", "--format", "json"],
            capture_output=True, text=True, timeout=10,
        )
        containers = []
        if con_result.returncode == 0:
            for line in con_result.stdout.strip().splitlines():
                if line:
                    containers.append(json.loads(line))

        # Build volume → containers map using the Mounts field (comma-separated volume names)
        vol_containers: dict[str, list] = {v["Name"]: [] for v in volumes}
        for c in containers:
            mounts_raw = c.get("Mounts", "") or ""
            for mount in mounts_raw.split(","):
                mount = mount.strip()
                if mount and mount in vol_containers:
                    vol_containers[mount].append({
                        "id": (c.get("ID", "") or "")[:12],
                        "name": c.get("Names", ""),
                        "state": c.get("State", ""),
                        "image": c.get("Image", ""),
                        "status": c.get("Status", ""),
                    })

        for v in volumes:
            v["containers"] = vol_containers.get(v["Name"], [])

        return volumes
    except FileNotFoundError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Docker not installed")
