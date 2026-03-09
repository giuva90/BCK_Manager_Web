"""Job execution routes — run backups, check status."""

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status

from backend.models.user import User
from backend.auth.dependencies import require_operator_or_admin, get_current_user
from backend.schemas.backup import RunRequest, JobStatusRead
from backend.services.bck_bridge import (
    bridge_run_job,
    bridge_run_all,
    get_job_state,
    get_all_job_states,
    JobStatus,
)
from backend.services.config_manager import get_jobs

logger = logging.getLogger("bck_web.run")

router = APIRouter(prefix="/run", tags=["run"])


@router.post("/all")
async def run_all(
    body: RunRequest = RunRequest(),
    user: User = Depends(require_operator_or_admin),
):
    """Launch all enabled backup jobs in the background."""
    server_id = body.server_id or 0
    logger.info("Run all jobs requested by user=%s server_id=%s", user.username, server_id)

    async def _run():
        try:
            await bridge_run_all(triggered_by=user.username, server_id=server_id)
            logger.info("Run all jobs completed: server_id=%s", server_id)
        except Exception as exc:
            logger.error("Run all jobs failed: %s", exc, exc_info=True)

    asyncio.create_task(_run())
    return {"message": "All backup jobs started", "server_id": server_id}


@router.post("/job/{name}")
async def run_job(
    name: str,
    body: RunRequest = RunRequest(),
    user: User = Depends(require_operator_or_admin),
):
    """Launch a specific backup job in the background."""
    server_id = body.server_id or 0

    # Verify job exists
    jobs = get_jobs()
    if not any(j.get("name") == name for j in jobs):
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Job '{name}' not found")

    current = get_job_state(name, server_id)
    if current.status == JobStatus.RUNNING:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Job '{name}' is already running")

    logger.info("Run job requested: name=%s user=%s server_id=%s", name, user.username, server_id)

    async def _run():
        try:
            await bridge_run_job(name, triggered_by=user.username, server_id=server_id)
            logger.info("Job completed: name=%s server_id=%s", name, server_id)
        except Exception as exc:
            logger.error("Job failed: name=%s error=%s", name, exc, exc_info=True)

    asyncio.create_task(_run())
    return {"message": f"Job '{name}' started", "server_id": server_id}


@router.get("/status", response_model=list[JobStatusRead])
async def all_status(
    server_id: Optional[int] = Query(0),
    _user: User = Depends(get_current_user),
):
    states = get_all_job_states(server_id or 0)
    return [
        JobStatusRead(
            job_name=name,
            status=s.status.value,
            started_at=s.started_at,
            finished_at=s.finished_at,
            triggered_by=s.triggered_by,
            last_result=s.last_result,
        )
        for name, s in states.items()
    ]


@router.get("/status/{name}", response_model=JobStatusRead)
async def job_status(
    name: str,
    server_id: Optional[int] = Query(0),
    _user: User = Depends(get_current_user),
):
    s = get_job_state(name, server_id or 0)
    return JobStatusRead(
        job_name=name,
        status=s.status.value,
        started_at=s.started_at,
        finished_at=s.finished_at,
        triggered_by=s.triggered_by,
        last_result=s.last_result,
    )
