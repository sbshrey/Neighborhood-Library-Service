from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models import LibraryPolicy
from ..schemas.policy import PolicyUpdate
from ..utils.audit_fields import stamp_created_updated_by
from .base import SQLQueryRunner


class CRUDPolicy(SQLQueryRunner):
    @staticmethod
    def _sync_runtime(policy: LibraryPolicy) -> None:
        settings.overdue_fine_per_day = policy.fine_per_day

    async def get_or_create(self, db: AsyncSession) -> LibraryPolicy:
        policy = await db.get(LibraryPolicy, 1)
        if not policy:
            policy = LibraryPolicy(
                id=1,
                enforce_limits=True,
                max_active_loans_per_user=5,
                max_loan_days=21,
                fine_per_day=2.0,
            )
            stamp_created_updated_by(policy, is_create=True)
            db.add(policy)
            await db.flush()
            await db.refresh(policy)
        self._sync_runtime(policy)
        return policy

    async def update(self, db: AsyncSession, payload: PolicyUpdate) -> LibraryPolicy:
        policy = await self.get_or_create(db)
        updates = payload.model_dump()
        for key, value in updates.items():
            setattr(policy, key, value)
        stamp_created_updated_by(policy, is_create=False)
        await db.flush()
        await db.refresh(policy)
        self._sync_runtime(policy)
        return policy


crud_policies = CRUDPolicy()
