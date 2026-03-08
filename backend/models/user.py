"""User ORM model."""

from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    email: str = Field(unique=True)
    hashed_password: str
    role: str = Field(default="operator")  # "admin" | "operator" | "viewer"
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None
    # JSON list of system usernames this web user may access via terminal
    allowed_system_users: str = Field(default="[]")


class RevokedToken(SQLModel, table=True):
    """Tracks revoked JWT tokens (jti) for logout support."""
    id: Optional[int] = Field(default=None, primary_key=True)
    jti: str = Field(unique=True, index=True)
    expires_at: datetime
