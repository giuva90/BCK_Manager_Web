"""Retention routes — preview and apply retention policies."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from backend.models.user import User
from backend.auth.dependencies import require_operator_or_admin
from backend.services.bck_bridge import bridge_apply_retention
from backend.services.config_manager import get_jobs

router = APIRouter(prefix="/retention", tags=["retention"])


class RetentionRequest(BaseModel):
    job_name: Optional[str] = None
    server_id: Optional[int] = None


@router.post("/preview")
async def preview_retention(
    body: RetentionRequest = RetentionRequest(),
    _user: User = Depends(require_operator_or_admin),
):
    """Dry-run retention — shows what would be deleted without actually deleting."""
    jobs = get_jobs()
    if body.job_name:
        jobs = [j for j in jobs if j.get("name") == body.job_name]
        if not jobs:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Job '{body.job_name}' not found")

    results = []
    for job in jobs:
        if not job.get("enabled", True):
            continue
        try:
            r = await bridge_apply_retention(job["name"], dry_run=True)
            results.append({"job_name": job["name"], **r})
        except Exception as e:
            results.append({"job_name": job["name"], "error": str(e)})
    return results


@router.post("/apply")
async def apply_retention(
    body: RetentionRequest = RetentionRequest(),
    _user: User = Depends(require_operator_or_admin),
):
    """Apply retention policies — actually deletes old backups."""
    jobs = get_jobs()
    if body.job_name:
        jobs = [j for j in jobs if j.get("name") == body.job_name]
        if not jobs:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Job '{body.job_name}' not found")

    results = []
    for job in jobs:
        if not job.get("enabled", True):
            continue
        try:
            r = await bridge_apply_retention(job["name"], dry_run=False)
            results.append({"job_name": job["name"], **r})
        except Exception as e:
            results.append({"job_name": job["name"], "error": str(e)})
    return results
