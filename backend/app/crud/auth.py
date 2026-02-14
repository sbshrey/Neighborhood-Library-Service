from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import User
from .base import SQLQueryRunner


class CRUDAuth(SQLQueryRunner):
    async def get_by_email(self, db: AsyncSession, email: str) -> User | None:
        return await self.scalar_one_or_none(db, select(User).where(User.email == email.strip()))


crud_auth = CRUDAuth()
