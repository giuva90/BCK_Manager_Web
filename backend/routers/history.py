"""Job execution history routes — list, detail, stats."""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select, func, col

from backend.models.user import User
from backend.models.job_execution import JobExecution
from backend.auth.dependencies import get_current_user
from backend.database import get_session
from backend.schemas.backup import JobExecutionRead, JobExecutionList, HistoryStats

router = APIRouter(prefix="/history", tags=["history"])


@router.get("", response_model=JobExecutionList)
async def list_executions(
    job_name: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    server_id: Optional[int] = Query(None),
    triggered_by: Optional[str] = Query(None),
    from_date: Optional[datetime] = Query(None),
    to_date: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    _user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    query = select(JobExecution)
    count_query = select(func.count()).select_from(JobExecution)

    # Apply filters
    if job_name:
        query = query.where(JobExecution.job_name == job_name)
        count_query = count_query.where(JobExecution.job_name == job_name)
    if status_filter:
        query = query.where(JobExecution.status == status_filter)
        count_query = count_query.where(JobExecution.status == status_filter)
    if server_id is not None:
        query = query.where(JobExecution.server_id == server_id)
        count_query = count_query.where(JobExecution.server_id == server_id)
    if triggered_by:
        query = query.where(JobExecution.triggered_by == triggered_by)
        count_query = count_query.where(JobExecution.triggered_by == triggered_by)
    if from_date:
        query = query.where(col(JobExecution.started_at) >= from_date)
        count_query = count_query.where(col(JobExecution.started_at) >= from_date)
    if to_date:
        query = query.where(col(JobExecution.started_at) <= to_date)
        count_query = count_query.where(col(JobExecution.started_at) <= to_date)

    total = session.exec(count_query).one()

    # Order by most recent first, paginate
    query = query.order_by(col(JobExecution.started_at).desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    items = session.exec(query).all()

    return JobExecutionList(
        items=[JobExecutionRead.model_validate(e, from_attributes=True) for e in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/stats", response_model=HistoryStats)
async def execution_stats(
    server_id: Optional[int] = Query(None),
    _user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    now = datetime.utcnow()
    day_ago = now - timedelta(hours=24)
    week_ago = now - timedelta(days=7)

    def _count(since: datetime, status_val: Optional[str] = None) -> int:
        q = select(func.count()).select_from(JobExecution).where(
            col(JobExecution.started_at) >= since
        )
        if server_id is not None:
            q = q.where(JobExecution.server_id == server_id)
        if status_val:
            q = q.where(JobExecution.status == status_val)
        return session.exec(q).one()

    # Recent executions (last 10)
    recent_q = select(JobExecution).order_by(col(JobExecution.started_at).desc()).limit(10)
    if server_id is not None:
        recent_q = recent_q.where(JobExecution.server_id == server_id)
    recent = session.exec(recent_q).all()

    return HistoryStats(
        total_24h=_count(day_ago),
        success_24h=_count(day_ago, "success"),
        failed_24h=_count(day_ago, "failed"),
        total_7d=_count(week_ago),
        success_7d=_count(week_ago, "success"),
        failed_7d=_count(week_ago, "failed"),
        recent=[JobExecutionRead.model_validate(e, from_attributes=True) for e in recent],
    )


@router.get("/{execution_id}", response_model=JobExecutionRead)
async def get_execution(
    execution_id: int,
    _user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    execution = session.get(JobExecution, execution_id)
    if execution is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Execution not found")
    return JobExecutionRead.model_validate(execution, from_attributes=True)
