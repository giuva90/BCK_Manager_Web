"""Backup-job-related Pydantic schemas."""

from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel, Field


# --- Retention ---

class RetentionSchema(BaseModel):
    mode: str = Field(default="none", pattern=r"^(none|simple|smart)$")
    days: Optional[int] = None
    daily_keep: Optional[int] = None
    monthly_keep: Optional[int] = None


# --- Encryption ---

class EncryptionSchema(BaseModel):
    enabled: bool = False
    algorithm: str = Field(default="AES-256-GCM")
    passphrase: Optional[str] = None
    key_name: Optional[str] = None


# --- Per-job notifications ---

class JobNotificationsSchema(BaseModel):
    additional_recipients: Optional[list[str]] = None
    exclusive_recipients: Optional[list[str]] = None


# --- Job CRUD ---

class JobCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    mode: str = Field(pattern=r"^(folder|files|volume)$")
    bucket: str
    s3_endpoint: str
    source_path: Optional[str] = None
    volume_name: Optional[str] = None
    prefix: str = ""
    enabled: bool = True
    pre_command: str = ""
    post_command: str = ""
    retention: RetentionSchema = RetentionSchema()
    encryption: EncryptionSchema = EncryptionSchema()
    notifications: JobNotificationsSchema = JobNotificationsSchema()


class JobUpdate(BaseModel):
    mode: Optional[str] = Field(default=None, pattern=r"^(folder|files|volume)$")
    bucket: Optional[str] = None
    s3_endpoint: Optional[str] = None
    source_path: Optional[str] = None
    volume_name: Optional[str] = None
    prefix: Optional[str] = None
    enabled: Optional[bool] = None
    pre_command: Optional[str] = None
    post_command: Optional[str] = None
    retention: Optional[RetentionSchema] = None
    encryption: Optional[EncryptionSchema] = None
    notifications: Optional[JobNotificationsSchema] = None


class JobRead(BaseModel):
    name: str
    mode: str
    bucket: str
    s3_endpoint: str
    source_path: Optional[str] = None
    volume_name: Optional[str] = None
    prefix: str = ""
    enabled: bool = True
    pre_command: str = ""
    post_command: str = ""
    retention: RetentionSchema = RetentionSchema()
    encryption: EncryptionSchema = EncryptionSchema()
    notifications: JobNotificationsSchema = JobNotificationsSchema()


# --- Run status ---

class JobStatusRead(BaseModel):
    job_name: str
    status: str  # idle | running | success | failed
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    triggered_by: Optional[str] = None
    last_result: Optional[dict[str, Any]] = None


class RunRequest(BaseModel):
    server_id: Optional[int] = None


# --- Execution history ---

class JobExecutionRead(BaseModel):
    id: int
    job_name: str
    server_id: int
    status: str
    started_at: datetime
    finished_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    triggered_by: str
    error: Optional[str] = None
    uploaded_files: int = 0
    uploaded_size: int = 0
    bucket: str = ""
    prefix: str = ""
    encrypted: bool = False
    result_json: Optional[str] = None


class JobExecutionList(BaseModel):
    items: list[JobExecutionRead]
    total: int
    page: int
    page_size: int


class HistoryStats(BaseModel):
    total_24h: int = 0
    success_24h: int = 0
    failed_24h: int = 0
    total_7d: int = 0
    success_7d: int = 0
    failed_7d: int = 0
    recent: list[JobExecutionRead] = []
