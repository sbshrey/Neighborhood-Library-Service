from datetime import datetime, timedelta, timezone

import pytest

from app.crud.books import crud_books
from app.crud.loans import crud_loans
from app.crud.policies import crud_policies
from app.crud.users import crud_users
from app.models import Loan
from app.schemas.books import BookCreate
from app.schemas.loans import LoanCreate, LoanUpdate
from app.schemas.policy import PolicyUpdate
from app.schemas.users import UserCreate


@pytest.mark.asyncio
async def test_crud_loans_list_update_and_return_edges(db_session):
    await crud_policies.update(
        db_session,
        PolicyUpdate(
            enforce_limits=True,
            max_active_loans_per_user=5,
            max_loan_days=10,
            fine_per_day=3.0,
        ),
    )
    user = await crud_users.create(
        db_session,
        obj_in=UserCreate(
            name="Direct CRUD User",
            email="direct-crud-user@test.dev",
            role="member",
            password="member-pass-123",
        ),
    )
    book = await crud_books.create(
        db_session,
        obj_in=BookCreate(
            title="Direct CRUD Book",
            author="Direct Author",
            copies_total=2,
        ),
    )

    loan = await crud_loans.borrow(
        db_session, LoanCreate(book_id=book.id, user_id=user.id, days=5)
    )

    loans_active = await crud_loans.list(
        db_session,
        active=True,
        user_id=user.id,
        book_id=book.id,
        overdue_only=False,
    )
    assert len(loans_active) == 1

    loan_for_overdue = Loan(
        book_id=book.id,
        user_id=user.id,
        borrowed_at=datetime.now(timezone.utc) - timedelta(days=6),
        due_at=datetime.now(timezone.utc) - timedelta(days=2),
        returned_at=None,
    )
    db_session.add(loan_for_overdue)
    await db_session.flush()

    overdue_only = await crud_loans.list(
        db_session,
        active=None,
        user_id=None,
        book_id=None,
        overdue_only=True,
    )
    assert len(overdue_only) >= 1

    with pytest.raises(ValueError, match="Loan extension exceeds allowed circulation window"):
        await crud_loans.update(
            db_session, loan.id, LoanUpdate(extend_days=10)
        )

    returned = await crud_loans.return_loan(db_session, loan.id)
    assert returned.returned_at is not None

    inactive = await crud_loans.list(
        db_session,
        active=False,
        user_id=None,
        book_id=None,
        overdue_only=False,
    )
    assert any(item.id == loan.id for item in inactive)

    with pytest.raises(ValueError, match="Loan already returned"):
        await crud_loans.return_loan(db_session, loan.id)

    with pytest.raises(ValueError, match="Loan not found"):
        await crud_loans.update(db_session, 999999, LoanUpdate(extend_days=1))


@pytest.mark.asyncio
async def test_crud_loan_remove_paths(db_session):
    user = await crud_users.create(
        db_session,
        obj_in=UserCreate(
            name="Remove User",
            email="remove-user@test.dev",
            role="member",
            password="member-pass-123",
        ),
    )
    book = await crud_books.create(
        db_session,
        obj_in=BookCreate(
            title="Remove Book",
            author="Remove Author",
            copies_total=1,
        ),
    )
    loan = await crud_loans.borrow(
        db_session, LoanCreate(book_id=book.id, user_id=user.id, days=3)
    )

    await crud_loans.remove(db_session, loan.id)
    refreshed_book = await crud_books.get(db_session, book.id)
    assert refreshed_book is not None
    assert refreshed_book.copies_available == 1

    with pytest.raises(ValueError, match="Loan not found"):
        await crud_loans.remove(db_session, loan.id)
