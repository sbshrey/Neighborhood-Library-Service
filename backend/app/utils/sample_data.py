from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from ..crud.books import crud_books
from ..crud.loans import crud_loans
from ..crud.users import crud_users
from .bulk_import import import_seed_india


async def seed_sample_data(db: AsyncSession) -> dict[str, Any]:
    books_count = await crud_books.count_all(db)
    users_count = await crud_users.count_all(db)
    loans_count = await crud_loans.count_all(db)

    if books_count or users_count or loans_count:
        return {
            "status": "skipped",
            "message": "Sample data already exists",
            "counts": {
                "books": books_count,
                "users": users_count,
                "loans": loans_count,
            },
        }

    imported = await import_seed_india(db)
    counts = {entry["entity"]: entry["imported"] for entry in imported["results"]}
    return {
        "status": "created",
        "source": "csv_seed_india",
        "counts": {
            "books": counts.get("books", 0),
            "users": counts.get("users", 0),
            "loans": counts.get("loans", 0),
        },
    }
