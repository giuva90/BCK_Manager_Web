"""FastAPI dependencies for authentication and authorization."""

from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request, status
from sqlmodel import Session, select

from backend.database import get_session
from backend.auth.jwt import decode_token
from backend.models.user import User, RevokedToken


def _get_token_from_cookie(request: Request) -> str:
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    return token


async def get_current_user(
    request: Request,
    session: Session = Depends(get_session),
) -> User:
    """Extract and validate JWT from cookie, return User."""
    token = _get_token_from_cookie(request)
    payload = decode_token(token)
    if payload is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")

    # Check revocation
    jti = payload.get("jti")
    if jti:
        revoked = session.exec(
            select(RevokedToken).where(RevokedToken.jti == jti)
        ).first()
        if revoked:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token revoked")

    username: str | None = payload.get("sub")
    if username is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token payload")

    user = session.exec(select(User).where(User.username == username)).first()
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")

    return user


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")
    return user


async def require_operator_or_admin(user: User = Depends(get_current_user)) -> User:
    if user.role not in ("admin", "operator"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Operator or admin access required")
    return user


def cleanup_expired_tokens(session: Session) -> int:
    """Delete expired revoked tokens.  Returns count deleted."""
    now = datetime.now(timezone.utc)
    expired = session.exec(
        select(RevokedToken).where(RevokedToken.expires_at < now)
    ).all()
    for tok in expired:
        session.delete(tok)
    session.commit()
    return len(expired)
