from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..deps import require_roles
from ..utils.bulk_import import (
    import_books_rows,
    import_loans_rows,
    import_users_rows,
    parse_upload_rows,
)

router = APIRouter(prefix="/imports", tags=["imports"])


@router.post("/books")
async def import_books(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles("admin")),
):
    rows = await parse_upload_rows(file, sheet_name="books")
    result = await import_books_rows(db, rows)
    return result.as_dict()


@router.post("/users")
async def import_users(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles("admin")),
):
    rows = await parse_upload_rows(file, sheet_name="users")
    result = await import_users_rows(db, rows)
    return result.as_dict()


@router.post("/loans")
async def import_loans(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles("admin")),
):
    rows = await parse_upload_rows(file, sheet_name="loans")
    result = await import_loans_rows(db, rows)
    return result.as_dict()
