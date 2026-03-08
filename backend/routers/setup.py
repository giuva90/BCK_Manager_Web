"""First-run setup — create the initial admin user.

Returns 410 Gone once the first user exists.
"""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlmodel import Session, select, func

from backend.database import get_session
from backend.models.user import User
from backend.auth.password import hash_password
from backend.auth.jwt import create_access_token, create_refresh_token
from backend.schemas.user import SetupRequest, UserRead

from datetime import datetime, timezone
import json

router = APIRouter(tags=["setup"])

_COOKIE_OPTS = {
    "httponly": True,
    "secure": True,
    "samesite": "strict",
    "path": "/",
}


@router.post("/setup")
async def setup(
    body: SetupRequest,
    response: Response,
    session: Session = Depends(get_session),
):
    # Check if any users exist
    count = session.exec(select(func.count()).select_from(User)).one()
    if count > 0:
        raise HTTPException(status.HTTP_410_GONE, "Setup already completed")

    user = User(
        username=body.username,
        email=body.email,
        hashed_password=hash_password(body.password),
        role="admin",
        is_active=True,
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    access, a_jti, a_exp = create_access_token(user.username, user.role)
    refresh, r_jti, r_exp = create_refresh_token(user.username, user.role)

    response.set_cookie("access_token", access, max_age=int((a_exp - datetime.now(timezone.utc)).total_seconds()), **_COOKIE_OPTS)
    response.set_cookie("refresh_token", refresh, max_age=int((r_exp - datetime.now(timezone.utc)).total_seconds()), **_COOKIE_OPTS)

    return {
        "message": "Admin user created",
        "user": UserRead(
            id=user.id,
            username=user.username,
            email=user.email,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at,
            last_login=user.last_login,
            allowed_system_users=json.loads(user.allowed_system_users),
        ),
    }
