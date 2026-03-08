"""User management routes — admin only."""

import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from backend.database import get_session
from backend.models.user import User
from backend.auth.password import hash_password
from backend.auth.dependencies import require_admin
from backend.schemas.user import UserCreate, UserUpdate, UserRead

router = APIRouter(prefix="/users", tags=["users"])


def _to_read(u: User) -> UserRead:
    return UserRead(
        id=u.id,
        username=u.username,
        email=u.email,
        role=u.role,
        is_active=u.is_active,
        created_at=u.created_at,
        last_login=u.last_login,
        allowed_system_users=json.loads(u.allowed_system_users),
    )


@router.get("", response_model=list[UserRead])
async def list_users(
    session: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
):
    users = session.exec(select(User)).all()
    return [_to_read(u) for u in users]


@router.post("", response_model=UserRead, status_code=201)
async def create_user(
    body: UserCreate,
    session: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
):
    existing = session.exec(
        select(User).where((User.username == body.username) | (User.email == body.email))
    ).first()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Username or email already exists")

    user = User(
        username=body.username,
        email=body.email,
        hashed_password=hash_password(body.password),
        role=body.role,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return _to_read(user)


@router.get("/{user_id}", response_model=UserRead)
async def get_user(
    user_id: int,
    session: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
):
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return _to_read(user)


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: int,
    body: UserUpdate,
    session: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
):
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    if body.email is not None:
        user.email = body.email
    if body.password is not None:
        user.hashed_password = hash_password(body.password)
    if body.role is not None:
        user.role = body.role
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.allowed_system_users is not None:
        user.allowed_system_users = json.dumps(body.allowed_system_users)

    session.add(user)
    session.commit()
    session.refresh(user)
    return _to_read(user)


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: int,
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if user.id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot delete yourself")
    session.delete(user)
    session.commit()
