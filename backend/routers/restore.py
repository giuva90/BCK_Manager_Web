"""Restore routes — list backups, restore files/volumes."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from backend.models.user import User
from backend.auth.dependencies import require_operator_or_admin
from backend.services.bck_bridge import (
    bridge_list_backups,
    bridge_restore_file,
    bridge_restore_volume,
)

router = APIRouter(prefix="/restore", tags=["restore"])


class FileRestoreRequest(BaseModel):
    s3_key: str
    server_id: Optional[int] = None


class VolumeRestoreRequest(BaseModel):
    s3_key: str
    target_volume: str
    mode: str = "new"  # "new" | "replace"
    server_id: Optional[int] = None


@router.get("/{job}/list")
async def list_backups(
    job: str,
    server_id: Optional[int] = Query(None),
    _user: User = Depends(require_operator_or_admin),
):
    try:
        backups = await bridge_list_backups(job)
    except ValueError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))
    # Sort by last_modified descending (newest first)
    backups.sort(key=lambda x: x.get("LastModified", ""), reverse=True)
    # Normalize boto3 uppercase keys to frontend-expected lowercase
    return [
        {
            "key": b.get("Key", ""),
            "size": b.get("Size", 0),
            "last_modified": b.get("LastModified", ""),
        }
        for b in backups
    ]


@router.post("/{job}/file")
async def restore_file_route(
    job: str,
    body: FileRestoreRequest,
    _user: User = Depends(require_operator_or_admin),
):
    try:
        success = await bridge_restore_file(job, body.s3_key)
    except ValueError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))
    except Exception as e:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, str(e))
    return {"success": success, "job": job, "s3_key": body.s3_key}


@router.post("/{job}/volume")
async def restore_volume_route(
    job: str,
    body: VolumeRestoreRequest,
    _user: User = Depends(require_operator_or_admin),
):
    replace_mode = body.mode == "replace"
    try:
        success = await bridge_restore_volume(
            job, body.s3_key, body.target_volume, replace_mode
        )
    except ValueError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))
    except Exception as e:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, str(e))
    return {
        "success": success,
        "job": job,
        "s3_key": body.s3_key,
        "target_volume": body.target_volume,
        "mode": body.mode,
    }
