"""Server (agent or SSH-only) ORM model for fleet management."""

from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field


class Server(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True)
    hostname: str
    connection_type: str                          # "agent" | "ssh"
    # Agent-specific
    agent_token_hash: Optional[str] = None        # bcrypt-hashed token
    agent_version: Optional[str] = None
    last_seen: Optional[datetime] = None
    # SSH-specific
    ssh_host: Optional[str] = None
    ssh_port: int = Field(default=22)
    ssh_user: Optional[str] = None
    ssh_key_path: Optional[str] = None            # path to private key on Hub
    # Common
    is_online: bool = Field(default=False)
    bck_manager_version: Optional[str] = None
    bck_manager_path: str = Field(default="/opt/bck_manager")
    config_path: str = Field(default="/opt/bck_manager/config.yaml")
    notes: str = Field(default="")
    added_at: datetime = Field(default_factory=datetime.utcnow)
    # JSON list of system usernames available in the web terminal for this server
    terminal_users: str = Field(default="[]")
