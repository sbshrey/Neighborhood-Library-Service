from typing import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_db
from .models import User
from .schemas.users import UserCreate
from .utils.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
optional_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def _auth_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def _resolve_user_from_token(db: AsyncSession, token: str) -> User:
    try:
        payload = decode_access_token(token)
    except ValueError as exc:
        raise _auth_error() from exc

    user_id = payload.get("uid")
    if not isinstance(user_id, int):
        raise _auth_error()

    user = await db.get(User, user_id)
    if not user:
        raise _auth_error()
    return user


async def get_current_user(
    db: AsyncSession = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> User:
    return await _resolve_user_from_token(db, token)


def require_roles(*allowed_roles: str) -> Callable:
    async def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return dependency


async def require_admin_or_bootstrap(
    db: AsyncSession = Depends(get_db), token: str | None = Depends(optional_oauth2_scheme)
) -> User | None:
    users_count = await db.scalar(select(func.count(User.id)))
    if (users_count or 0) == 0:
        return None
    if not token:
        raise _auth_error()

    user = await _resolve_user_from_token(db, token)
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return user


async def require_admin_or_bootstrap_for_user_create(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    token: str | None = Depends(optional_oauth2_scheme),
) -> User | None:
    users_count = await db.scalar(select(func.count(User.id)))
    if (users_count or 0) == 0:
        if payload.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="First user must be created with admin role.",
            )
        return None

    if not token:
        if payload.role == "admin":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Bootstrap already completed. Please sign in with an existing admin user.",
            )
        raise _auth_error()
    user = await _resolve_user_from_token(db, token)
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return user
