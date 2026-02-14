from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Book, Loan, User
from .bulk_import import import_seed_india


async def seed_sample_data(db: AsyncSession) -> dict[str, Any]:
    books_count = await db.scalar(select(func.count(Book.id)))
    users_count = await db.scalar(select(func.count(User.id)))
    loans_count = await db.scalar(select(func.count(Loan.id)))

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
