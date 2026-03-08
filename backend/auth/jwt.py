"""JWT token creation and validation."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from jose import JWTError, jwt

from backend.config import settings

ALGORITHM = "HS256"


def create_access_token(username: str, role: str) -> tuple[str, str, datetime]:
    """Return (token, jti, expires_at)."""
    jti = str(uuid4())
    expires = datetime.now(timezone.utc) + timedelta(hours=settings.access_token_expire_hours)
    payload = {"sub": username, "role": role, "jti": jti, "exp": expires}
    token = jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)
    return token, jti, expires


def create_refresh_token(username: str, role: str) -> tuple[str, str, datetime]:
    """Return (token, jti, expires_at)."""
    jti = str(uuid4())
    expires = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    payload = {"sub": username, "role": role, "jti": jti, "type": "refresh", "exp": expires}
    token = jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)
    return token, jti, expires


def decode_token(token: str) -> dict | None:
    """Decode and validate a JWT.  Returns payload dict or None."""
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    except JWTError:
        return None
