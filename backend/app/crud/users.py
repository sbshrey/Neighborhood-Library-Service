from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models import Loan, User
from ..schemas.users import UserCreate, UserUpdate
from ..utils.security import hash_password
from .base import CRUDBase


class CRUDUser(CRUDBase[User, UserCreate, UserUpdate]):
    async def active_loans(self, db: AsyncSession, user_id: int) -> int:
        return await db.scalar(
            select(func.count(Loan.id)).where(Loan.user_id == user_id, Loan.returned_at.is_(None))
        )

    async def create(self, db: AsyncSession, *, obj_in: UserCreate) -> User:
        raw_password = obj_in.password or settings.default_user_password
        user = User(
            name=obj_in.name.strip(),
            email=obj_in.email.strip() if obj_in.email else None,
            phone=obj_in.phone.strip() if obj_in.phone else None,
            password_hash=hash_password(raw_password),
            role=obj_in.role,
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)
        return user

    async def update(self, db: AsyncSession, *, db_obj: User, obj_in: UserUpdate) -> User:
        updates = obj_in.model_dump(exclude_unset=True)
        if "password" in updates:
            password = updates.pop("password")
            if password:
                db_obj.password_hash = hash_password(password)
        for key, value in updates.items():
            setattr(db_obj, key, value)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj


crud_users = CRUDUser(User)
