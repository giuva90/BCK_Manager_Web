"""Password hashing utilities — bcrypt (direct, passlib-free).

passlib's bcrypt backend is incompatible with bcrypt>=4.0.0 because the
newer library rejects passwords longer than 72 bytes, which passlib uses
internally during its wrap-bug detection routine.  Using bcrypt directly
avoids the issue entirely.
"""

import bcrypt


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
