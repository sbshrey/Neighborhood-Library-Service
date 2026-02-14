from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import get_db
from ..deps import require_roles
from ..utils.sample_data import seed_sample_data

router = APIRouter(prefix="/seed", tags=["seed"])


@router.post("")
async def seed(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles("admin")),
):
    if not getattr(settings, "enable_seed", True):
        raise HTTPException(status_code=403, detail="Seeding is disabled")
    return await seed_sample_data(db)
