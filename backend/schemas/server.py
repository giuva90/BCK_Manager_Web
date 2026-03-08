"""Server / fleet-related Pydantic schemas."""

from datetime import datetime
from typing import Optional, Any, Literal

from pydantic import BaseModel, Field


class ServerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    hostname: str
    connection_type: Literal["agent", "ssh"]
    # SSH-specific
    ssh_host: Optional[str] = None
    ssh_port: int = 22
    ssh_user: Optional[str] = None
    ssh_key_path: Optional[str] = None
    # Common
    bck_manager_path: str = "/opt/bck_manager"
    config_path: str = "/opt/bck_manager/config.yaml"
    notes: str = ""
    terminal_users: list[str] = []


class ServerUpdate(BaseModel):
    name: Optional[str] = None
    hostname: Optional[str] = None
    ssh_host: Optional[str] = None
    ssh_port: Optional[int] = None
    ssh_user: Optional[str] = None
    ssh_key_path: Optional[str] = None
    bck_manager_path: Optional[str] = None
    config_path: Optional[str] = None
    notes: Optional[str] = None
    terminal_users: Optional[list[str]] = None


class ServerRead(BaseModel):
    id: int
    name: str
    hostname: str
    connection_type: str
    agent_version: Optional[str] = None
    last_seen: Optional[datetime] = None
    ssh_host: Optional[str] = None
    ssh_port: int = 22
    ssh_user: Optional[str] = None
    is_online: bool = False
    bck_manager_version: Optional[str] = None
    bck_manager_path: str
    config_path: str
    notes: str = ""
    added_at: datetime
    terminal_users: list[str] = []


class AgentTokenResponse(BaseModel):
    token: str
    install_command: str


# --- Agent WebSocket protocol ---

class AgentMessage(BaseModel):
    id: str     # UUID — correlates request to response
    type: Literal[
        # Hub → Agent (commands)
        "ping", "run_job", "run_all", "get_status", "get_jobs", "get_config",
        "list_backups", "restore_file", "restore_volume",
        "apply_retention", "preview_retention",
        "list_buckets", "browse_storage", "download_file",
        "browse_filesystem", "list_volumes", "list_containers",
        "get_logs", "stream_logs_start", "stream_logs_stop",
        # Agent → Hub (responses and push events)
        "pong", "result", "log_line",
        "job_started", "job_finished",
        "heartbeat",
        "registration",
    ]
    payload: dict[str, Any] = {}
    error: Optional[str] = None
