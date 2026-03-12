"""Job execution history ORM model."""

from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field


class JobExecution(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    job_name: str = Field(index=True)
    server_id: int = Field(default=0, index=True)      # 0 = local/standalone
    status: str = Field(index=True)                     # "success" | "failed"
    started_at: datetime = Field(index=True)
    finished_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    triggered_by: str = Field(default="system")         # username or "system"/"cron"
    error: Optional[str] = None
    uploaded_files: int = Field(default=0)
    uploaded_size: int = Field(default=0)                # total bytes
    bucket: str = Field(default="")
    prefix: str = Field(default="")
    encrypted: bool = Field(default=False)
    result_json: Optional[str] = None                    # full result dict as JSON
