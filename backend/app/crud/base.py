from typing import Any, Generic, TypeVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..utils.audit_fields import stamp_created_updated_by

ModelType = TypeVar("ModelType")
CreateSchemaType = TypeVar("CreateSchemaType")
UpdateSchemaType = TypeVar("UpdateSchemaType")


class SQLQueryRunner:
    async def execute(self, db: AsyncSession, statement: Any):
        return await db.execute(statement)

    async def scalar(self, db: AsyncSession, statement: Any, default: Any = None) -> Any:
        value = await db.scalar(statement)
        return default if value is None else value

    async def scalar_one_or_none(self, db: AsyncSession, statement: Any) -> Any:
        return (await self.execute(db, statement)).scalar_one_or_none()

    async def scalars_all(self, db: AsyncSession, statement: Any) -> list[Any]:
        return list((await self.execute(db, statement)).scalars().all())

    async def rows_all(self, db: AsyncSession, statement: Any) -> list[Any]:
        return list((await self.execute(db, statement)).all())

    async def first_row(self, db: AsyncSession, statement: Any) -> Any:
        return (await self.execute(db, statement)).first()


class CRUDBase(SQLQueryRunner, Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    def __init__(self, model: type[ModelType]):
        self.model = model

    async def get(self, db: AsyncSession, obj_id: int) -> ModelType | None:
        return await db.get(self.model, obj_id)

    async def get_multi(self, db: AsyncSession, *, skip: int = 0, limit: int = 100) -> list[ModelType]:
        return await self.scalars_all(db, select(self.model).offset(skip).limit(limit))

    async def create(self, db: AsyncSession, *, obj_in: CreateSchemaType) -> ModelType:
        obj = self.model(**obj_in.model_dump())
        stamp_created_updated_by(obj, is_create=True)
        db.add(obj)
        await db.flush()
        await db.refresh(obj)
        return obj

    async def update(
        self, db: AsyncSession, *, db_obj: ModelType, obj_in: UpdateSchemaType | dict[str, Any]
    ) -> ModelType:
        data = obj_in if isinstance(obj_in, dict) else obj_in.model_dump(exclude_unset=True)
        for field, value in data.items():
            setattr(db_obj, field, value)
        stamp_created_updated_by(db_obj, is_create=False)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def remove(self, db: AsyncSession, *, obj_id: int) -> ModelType | None:
        obj = await db.get(self.model, obj_id)
        if not obj:
            return None
        await db.delete(obj)
        await db.flush()
        return obj
