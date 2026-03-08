"""Audit log ORM model."""

from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field


class AuditLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    timestamp: datetime = Field(default_factory=datetime.utcnow, index=True)
    user: str = Field(index=True)           # web username who performed the action
    action: str                              # e.g. "run_job", "restore", "user_create"
    target: str = Field(default="")          # e.g. job name, user id, server name
    details: str = Field(default="")         # JSON-encoded extra info
    server_id: Optional[int] = None          # relevant server (fleet mode)
