"""Auth routes — login, logout, refresh, me."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from sqlmodel import Session, select

from backend.database import get_session
from backend.models.user import User, RevokedToken
from backend.auth.password import verify_password
from backend.auth.jwt import create_access_token, create_refresh_token, decode_token
from backend.auth.dependencies import get_current_user
from backend.schemas.user import LoginRequest, UserRead

import json

router = APIRouter(prefix="/auth", tags=["auth"])

_COOKIE_OPTS = {
    "httponly": True,
    "secure": True,
    "samesite": "strict",
    "path": "/",
}


@router.post("/login")
async def login(
    body: LoginRequest,
    response: Response,
    session: Session = Depends(get_session),
):
    user = session.exec(
        select(User).where(User.username == body.username)
    ).first()
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account disabled")

    access, a_jti, a_exp = create_access_token(user.username, user.role)
    refresh, r_jti, r_exp = create_refresh_token(user.username, user.role)

    user.last_login = datetime.now(timezone.utc)
    session.add(user)
    session.commit()

    response.set_cookie("access_token", access, max_age=int((a_exp - datetime.now(timezone.utc)).total_seconds()), **_COOKIE_OPTS)
    response.set_cookie("refresh_token", refresh, max_age=int((r_exp - datetime.now(timezone.utc)).total_seconds()), **_COOKIE_OPTS)

    return {
        "message": "Login successful",
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


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    session: Session = Depends(get_session),
):
    # Revoke access token
    token = request.cookies.get("access_token")
    if token:
        payload = decode_token(token)
        if payload and "jti" in payload:
            from datetime import datetime
            session.add(RevokedToken(
                jti=payload["jti"],
                expires_at=datetime.fromtimestamp(payload["exp"], tz=timezone.utc),
            ))
    # Revoke refresh token
    rtoken = request.cookies.get("refresh_token")
    if rtoken:
        payload = decode_token(rtoken)
        if payload and "jti" in payload:
            session.add(RevokedToken(
                jti=payload["jti"],
                expires_at=datetime.fromtimestamp(payload["exp"], tz=timezone.utc),
            ))
    session.commit()

    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out"}


@router.post("/refresh")
async def refresh(
    request: Request,
    response: Response,
    session: Session = Depends(get_session),
):
    rtoken = request.cookies.get("refresh_token")
    if not rtoken:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "No refresh token")

    payload = decode_token(rtoken)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")

    # Check revocation
    jti = payload.get("jti")
    if jti:
        revoked = session.exec(select(RevokedToken).where(RevokedToken.jti == jti)).first()
        if revoked:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token revoked")

    user = session.exec(select(User).where(User.username == payload["sub"])).first()
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")

    access, a_jti, a_exp = create_access_token(user.username, user.role)
    response.set_cookie("access_token", access, max_age=int((a_exp - datetime.now(timezone.utc)).total_seconds()), **_COOKIE_OPTS)

    return {"message": "Token refreshed"}


@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    return UserRead(
        id=user.id,
        username=user.username,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        last_login=user.last_login,
        allowed_system_users=json.loads(user.allowed_system_users),
    )
