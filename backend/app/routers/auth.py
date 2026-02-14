from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import get_db
from ..deps import get_current_user
from ..models import User
from ..schemas.auth import AuthUser, LoginRequest, TokenOut
from ..utils.security import create_access_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenOut)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.email == payload.email)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(
        user_id=user.id,
        role=user.role,
        subject=user.email or str(user.id),
    )
    return TokenOut(
        access_token=token,
        expires_in=settings.jwt_access_token_expires_minutes * 60,
        user=AuthUser(id=user.id, name=user.name, email=user.email, role=user.role),
    )


@router.get("/me", response_model=AuthUser)
async def me(current_user: User = Depends(get_current_user)):
    return AuthUser(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role,
    )
