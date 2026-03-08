"""Cron job metadata ORM model."""

from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field


class CronJob(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    label: str
    server_id: Optional[int] = None          # None = local server in standalone mode
    job_name: Optional[str] = None           # None = --run-all
    command: str                             # Full shell command
    cron_expression: str                     # e.g. "0 2 * * *"
    enabled: bool = Field(default=True)
    created_by: str                          # web username
    created_at: datetime = Field(default_factory=datetime.utcnow)
