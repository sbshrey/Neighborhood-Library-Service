from typing import Any, Callable, Sequence

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db

IntegrityErrorHandler = Callable[[IntegrityError], tuple[int, str]]
DeletePrecheck = Callable[[int, AsyncSession], Any]


def register_crud_endpoints(
    router: APIRouter,
    *,
    crud: Any,
    create_schema: type[Any],
    update_schema: type[Any],
    response_schema: type[Any],
    not_found_detail: str,
    create_dependencies: Sequence[Any] | None = None,
    get_dependencies: Sequence[Any] | None = None,
    update_dependencies: Sequence[Any] | None = None,
    delete_dependencies: Sequence[Any] | None = None,
    delete_precheck: DeletePrecheck | None = None,
    integrity_error_handler: IntegrityErrorHandler | None = None,
    create_db_error_detail: str = "Database error while creating record.",
    update_db_error_detail: str = "Database error while updating record.",
) -> None:
    def _map_integrity_error(exc: IntegrityError, default_detail: str) -> HTTPException:
        if integrity_error_handler:
            code, detail = integrity_error_handler(exc)
            return HTTPException(status_code=code, detail=detail)
        return HTTPException(status_code=409, detail=default_detail)

    @router.post(
        "",
        response_model=response_schema,
        status_code=status.HTTP_201_CREATED,
        dependencies=list(create_dependencies or []),
    )
    async def create_item(payload: create_schema, db: AsyncSession = Depends(get_db)):
        try:
            return await crud.create(db, obj_in=payload)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except IntegrityError as exc:
            await db.rollback()
            raise _map_integrity_error(exc, "Data conflicts with existing records.") from exc
        except SQLAlchemyError as exc:
            await db.rollback()
            raise HTTPException(status_code=500, detail=create_db_error_detail) from exc

    @router.get(
        "/{item_id}",
        response_model=response_schema,
        dependencies=list(get_dependencies or []),
    )
    async def get_item(item_id: int, db: AsyncSession = Depends(get_db)):
        item = await crud.get(db, item_id)
        if not item:
            raise HTTPException(status_code=404, detail=not_found_detail)
        return item

    @router.patch(
        "/{item_id}",
        response_model=response_schema,
        dependencies=list(update_dependencies or []),
    )
    async def update_item(
        item_id: int, payload: update_schema, db: AsyncSession = Depends(get_db)
    ):
        item = await crud.get(db, item_id)
        if not item:
            raise HTTPException(status_code=404, detail=not_found_detail)

        try:
            return await crud.update(db, db_obj=item, obj_in=payload)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except IntegrityError as exc:
            await db.rollback()
            raise _map_integrity_error(exc, "Data conflicts with existing records.") from exc
        except SQLAlchemyError as exc:
            await db.rollback()
            raise HTTPException(status_code=500, detail=update_db_error_detail) from exc

    @router.delete(
        "/{item_id}",
        status_code=status.HTTP_204_NO_CONTENT,
        dependencies=list(delete_dependencies or []),
    )
    async def delete_item(item_id: int, db: AsyncSession = Depends(get_db)):
        item = await crud.get(db, item_id)
        if not item:
            raise HTTPException(status_code=404, detail=not_found_detail)

        if delete_precheck:
            result = delete_precheck(item_id, db)
            if hasattr(result, "__await__"):
                await result

        await crud.remove(db, obj_id=item_id)
