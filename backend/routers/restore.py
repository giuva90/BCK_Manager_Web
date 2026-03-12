"""Restore routes — list backups, restore files/volumes."""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from backend.models.user import User
from backend.auth.dependencies import require_operator_or_admin
from backend.services.bck_bridge import (
    _persist_execution,
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
    target_volume: Optional[str] = None
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
    user: User = Depends(require_operator_or_admin),
):
    started_at = datetime.now(timezone.utc)
    error_msg: Optional[str] = None
    success = False
    try:
        success = await bridge_restore_file(job, body.s3_key)
    except ValueError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))
    except Exception as e:
        error_msg = str(e)
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
    finally:
        finished_at = datetime.now(timezone.utc)
        _persist_execution(
            {
                "job_name": job,
                "success": success,
                "error": error_msg,
                "bucket": body.s3_key.split("/")[0] if "/" in body.s3_key else "",
                "prefix": body.s3_key,
                "triggered_by": f"restore:{user.username}",
            },
            started_at,
            finished_at,
            triggered_by=f"restore:{user.username}",
        )
    return {"success": success, "job": job, "s3_key": body.s3_key}


@router.post("/{job}/volume")
async def restore_volume_route(
    job: str,
    body: VolumeRestoreRequest,
    user: User = Depends(require_operator_or_admin),
):
    replace_mode = body.mode == "replace"
    started_at = datetime.now(timezone.utc)
    error_msg: Optional[str] = None
    success = False
    try:
        success = await bridge_restore_volume(
            job, body.s3_key, body.target_volume, replace_mode
        )
    except ValueError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))
    except Exception as e:
        error_msg = str(e)
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
    finally:
        finished_at = datetime.now(timezone.utc)
        _persist_execution(
            {
                "job_name": job,
                "success": success,
                "error": error_msg,
                "bucket": body.s3_key.split("/")[0] if "/" in body.s3_key else "",
                "prefix": body.s3_key,
                "triggered_by": f"restore-volume:{user.username}",
            },
            started_at,
            finished_at,
            triggered_by=f"restore-volume:{user.username}",
        )
    return {"success": success, "job": job, "s3_key": body.s3_key, "mode": body.mode}
