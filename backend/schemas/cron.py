"""Cron-job-related Pydantic schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CronJobCreate(BaseModel):
    label: str = Field(min_length=1, max_length=128)
    job_name: Optional[str] = None           # None = --run-all
    cron_expression: str = Field(min_length=9, max_length=64)  # e.g. "0 2 * * *"
    server_id: Optional[int] = None
    enabled: bool = True


class CronJobUpdate(BaseModel):
    label: Optional[str] = Field(default=None, min_length=1, max_length=128)
    job_name: Optional[str] = None
    cron_expression: Optional[str] = Field(default=None, min_length=9, max_length=64)
    enabled: Optional[bool] = None


class CronJobRead(BaseModel):
    id: int
    label: str
    server_id: Optional[int] = None
    job_name: Optional[str] = None
    command: str
    cron_expression: str
    enabled: bool
    created_by: str
    created_at: datetime
