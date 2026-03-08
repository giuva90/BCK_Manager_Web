"""User-related Pydantic schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class SetupRequest(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    email: str
    password: str = Field(min_length=8)


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    email: str
    password: str = Field(min_length=8)
    role: str = Field(default="operator", pattern=r"^(admin|operator|viewer)$")


class UserUpdate(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = Field(default=None, min_length=8)
    role: Optional[str] = Field(default=None, pattern=r"^(admin|operator|viewer)$")
    is_active: Optional[bool] = None
    allowed_system_users: Optional[list[str]] = None


class UserRead(BaseModel):
    id: int
    username: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None
    allowed_system_users: list[str] = []


class TokenPayload(BaseModel):
    sub: str
    role: str
    jti: str
