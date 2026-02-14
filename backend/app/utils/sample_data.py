from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..crud.books import crud_books
from ..crud.loans import crud_loans
from ..crud.users import crud_users
from ..models import Book, Loan, User
from ..schemas.books import BookCreate
from ..schemas.loans import LoanCreate
from ..schemas.users import UserCreate

SAMPLE_PASSWORD = settings.default_user_password


SAMPLE_BOOKS = [
    BookCreate(
        title="The Pragmatic Programmer",
        author="Andrew Hunt",
        subject="Software Engineering",
        rack_number="SE-A1",
        isbn="9780201616224",
        published_year=1999,
        copies_total=3,
    ),
    BookCreate(
        title="Clean Code",
        author="Robert C. Martin",
        subject="Software Engineering",
        rack_number="SE-A2",
        isbn="9780132350884",
        published_year=2008,
        copies_total=2,
    ),
    BookCreate(
        title="Designing Data-Intensive Applications",
        author="Martin Kleppmann",
        subject="Distributed Systems",
        rack_number="DS-B1",
        isbn="9781449373320",
        published_year=2017,
        copies_total=2,
    ),
    BookCreate(
        title="Refactoring",
        author="Martin Fowler",
        subject="Software Engineering",
        rack_number="SE-A3",
        isbn="9780201485677",
        published_year=1999,
        copies_total=1,
    ),
    BookCreate(
        title="Working Effectively with Legacy Code",
        author="Michael Feathers",
        subject="Software Engineering",
        rack_number="SE-A4",
        isbn="9780131177055",
        published_year=2004,
        copies_total=1,
    ),
]

SAMPLE_USERS = [
    UserCreate(
        name="Avery Taylor",
        email="avery@library.dev",
        phone="555-0111",
        role="staff",
        password=SAMPLE_PASSWORD,
    ),
    UserCreate(
        name="Jordan Lee",
        email="jordan@library.dev",
        phone="555-0112",
        role="member",
        password=SAMPLE_PASSWORD,
    ),
    UserCreate(
        name="Riley Chen",
        email="riley@library.dev",
        phone="555-0113",
        role="member",
        password=SAMPLE_PASSWORD,
    ),
    UserCreate(
        name="Casey Morgan",
        email="casey@library.dev",
        phone="555-0114",
        role="admin",
        password=SAMPLE_PASSWORD,
    ),
]


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

    created_books = [await crud_books.create(db, obj_in=book) for book in SAMPLE_BOOKS]
    created_users = [await crud_users.create(db, obj_in=user) for user in SAMPLE_USERS]

    loans = [
        LoanCreate(book_id=created_books[0].id, user_id=created_users[1].id, days=14),
        LoanCreate(book_id=created_books[2].id, user_id=created_users[2].id, days=21),
        LoanCreate(book_id=created_books[1].id, user_id=created_users[0].id, days=7),
    ]
    created_loans = []
    for payload in loans:
        created_loans.append(await crud_loans.borrow(db, payload))

    return {
        "status": "created",
        "counts": {
            "books": len(created_books),
            "users": len(created_users),
            "loans": len(created_loans),
        },
    }
