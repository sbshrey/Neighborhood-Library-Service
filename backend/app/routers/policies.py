from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..crud.policies import crud_policies
from ..db import get_db
from ..deps import require_roles
from ..schemas.policy import PolicyOut, PolicyUpdate

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/policy", response_model=PolicyOut)
async def get_policy(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles("staff", "admin")),
):
    return await crud_policies.get_or_create(db)


@router.put("/policy", response_model=PolicyOut)
async def update_policy(
    payload: PolicyUpdate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles("admin")),
):
    return await crud_policies.update(db, payload)
