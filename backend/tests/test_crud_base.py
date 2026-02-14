import pytest

from app.crud.base import CRUDBase
from app.models.book import Book


class _CreatePayload:
    def model_dump(self):
        return {
            "title": "Base CRUD Book",
            "author": "Tester",
            "isbn": "123",
            "published_year": 2024,
            "copies_total": 2,
            "copies_available": 2,
        }


class _UpdatePayload:
    def model_dump(self, exclude_unset=True):
        assert exclude_unset is True
        return {"author": "Updated Author"}


@pytest.mark.asyncio
async def test_crud_base_get_create_update_remove(db_session):
    crud = CRUDBase(Book)

    created = await crud.create(db_session, obj_in=_CreatePayload())
    assert created.id is not None

    fetched = await crud.get(db_session, created.id)
    assert fetched is not None
    assert fetched.title == "Base CRUD Book"

    multi = await crud.get_multi(db_session, skip=0, limit=10)
    assert len(multi) == 1

    updated_from_dict = await crud.update(
        db_session, db_obj=created, obj_in={"title": "Updated Title"}
    )
    assert updated_from_dict.title == "Updated Title"

    updated_from_schema = await crud.update(
        db_session, db_obj=created, obj_in=_UpdatePayload()
    )
    assert updated_from_schema.author == "Updated Author"

    removed = await crud.remove(db_session, obj_id=created.id)
    assert removed is not None
    assert removed.id == created.id

    assert await crud.remove(db_session, obj_id=999999) is None
