"""Cron scheduling routes — CRUD + crontab sync."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select
from typing import Optional

from backend.database import get_session
from backend.models.user import User
from backend.models.cron_job import CronJob
from backend.auth.dependencies import require_operator_or_admin, get_current_user
from backend.schemas.cron import CronJobCreate, CronJobUpdate, CronJobRead
from backend.services.cron_manager import build_command, sync_to_crontab, get_next_runs

router = APIRouter(prefix="/cron", tags=["cron"])


def _to_read(c: CronJob) -> CronJobRead:
    return CronJobRead(
        id=c.id,
        label=c.label,
        server_id=c.server_id,
        job_name=c.job_name,
        command=c.command,
        cron_expression=c.cron_expression,
        enabled=c.enabled,
        created_by=c.created_by,
        created_at=c.created_at,
    )


def _sync(session: Session):
    """Re-sync all cron jobs to the system crontab."""
    all_jobs = session.exec(select(CronJob)).all()
    try:
        sync_to_crontab(list(all_jobs))
    except Exception:
        pass  # crontab may not be available in dev


@router.get("", response_model=list[CronJobRead])
async def list_cron_jobs(
    server_id: Optional[int] = Query(None),
    session: Session = Depends(get_session),
    _user: User = Depends(get_current_user),
):
    stmt = select(CronJob)
    if server_id is not None:
        stmt = stmt.where(CronJob.server_id == server_id)
    return [_to_read(c) for c in session.exec(stmt).all()]


@router.post("", response_model=CronJobRead, status_code=201)
async def create_cron_job(
    body: CronJobCreate,
    session: Session = Depends(get_session),
    user: User = Depends(require_operator_or_admin),
):
    cron = CronJob(
        label=body.label,
        server_id=body.server_id,
        job_name=body.job_name,
        command=build_command(body.job_name),
        cron_expression=body.cron_expression,
        enabled=body.enabled,
        created_by=user.username,
        created_at=datetime.now(timezone.utc),
    )
    session.add(cron)
    session.commit()
    session.refresh(cron)
    _sync(session)
    return _to_read(cron)


@router.put("/{cron_id}", response_model=CronJobRead)
async def update_cron_job(
    cron_id: int,
    body: CronJobUpdate,
    session: Session = Depends(get_session),
    _user: User = Depends(require_operator_or_admin),
):
    cron = session.get(CronJob, cron_id)
    if cron is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cron job not found")

    if body.label is not None:
        cron.label = body.label
    if body.job_name is not None:
        cron.job_name = body.job_name
        cron.command = build_command(body.job_name)
    if body.cron_expression is not None:
        cron.cron_expression = body.cron_expression
    if body.enabled is not None:
        cron.enabled = body.enabled

    session.add(cron)
    session.commit()
    session.refresh(cron)
    _sync(session)
    return _to_read(cron)


@router.delete("/{cron_id}", status_code=204)
async def delete_cron_job(
    cron_id: int,
    session: Session = Depends(get_session),
    _user: User = Depends(require_operator_or_admin),
):
    cron = session.get(CronJob, cron_id)
    if cron is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cron job not found")
    session.delete(cron)
    session.commit()
    _sync(session)


@router.get("/{cron_id}/next-runs")
async def next_runs(
    cron_id: int,
    session: Session = Depends(get_session),
    _user: User = Depends(get_current_user),
):
    cron = session.get(CronJob, cron_id)
    if cron is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cron job not found")
    runs = get_next_runs(cron.cron_expression, count=5)
    return {"cron_expression": cron.cron_expression, "next_runs": runs}
