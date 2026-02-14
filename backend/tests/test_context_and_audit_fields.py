import pytest

from app.models import Book, Loan
from app.utils.request_context import get_actor_role, get_actor_user_id


from tests.constants import TEST_AUTH_VALUE
@pytest.mark.asyncio
async def test_created_by_and_updated_by_are_stamped(client, db_session, auth_headers):
    create_book = await client.post(
        "/books",
        json={"title": "Stamped Book", "author": "Stamped Author", "copies_total": 2},
        headers=auth_headers,
    )
    assert create_book.status_code == 201
    book_id = create_book.json()["id"]

    book = await db_session.get(Book, book_id)
    assert book is not None
    assert book.created_by == 1
    assert book.updated_by == 1

    update_book = await client.patch(
        f"/books/{book_id}",
        json={"copies_total": 3},
        headers=auth_headers,
    )
    assert update_book.status_code == 200

    book_after = await db_session.get(Book, book_id)
    assert book_after is not None
    assert book_after.updated_by == 1


@pytest.mark.asyncio
async def test_loan_audit_fields_track_staff_actor(client, db_session, auth_headers):
    create_staff = await client.post(
        "/users",
        json={
            "name": "Field Staff",
            "email": "field-staff@test.dev",
            "role": "staff",
            "password": TEST_AUTH_VALUE,
        },
        headers=auth_headers,
    )
    assert create_staff.status_code == 201
    staff_id = create_staff.json()["id"]

    create_member = await client.post(
        "/users",
        json={"name": "Member For Loan", "email": "member-loan@test.dev", "role": "member"},
        headers=auth_headers,
    )
    assert create_member.status_code == 201

    create_book = await client.post(
        "/books",
        json={"title": "Loan Field Book", "author": "Loan Field Author", "copies_total": 1},
        headers=auth_headers,
    )
    assert create_book.status_code == 201

    login_staff = await client.post(
        "/auth/login",
        json={"email": "field-staff@test.dev", "password": TEST_AUTH_VALUE},
    )
    assert login_staff.status_code == 200
    staff_headers = {"Authorization": f"Bearer {login_staff.json()['access_token']}"}

    borrow = await client.post(
        "/loans/borrow",
        json={
            "book_id": create_book.json()["id"],
            "user_id": create_member.json()["id"],
            "days": 7,
        },
        headers=staff_headers,
    )
    assert borrow.status_code == 201
    loan_id = borrow.json()["id"]

    loan = await db_session.get(Loan, loan_id)
    assert loan is not None
    assert loan.created_by == staff_id
    assert loan.updated_by == staff_id

    returned = await client.post(f"/loans/{loan_id}/return", headers=staff_headers)
    assert returned.status_code == 200

    loan_after = await db_session.get(Loan, loan_id)
    assert loan_after is not None
    assert loan_after.updated_by == staff_id


@pytest.mark.asyncio
async def test_request_context_cleared_after_request(client, auth_headers):
    response = await client.post(
        "/books",
        json={"title": "Context Book", "author": "Context Author", "copies_total": 1},
        headers=auth_headers,
    )
    assert response.status_code == 201
    assert get_actor_user_id() is None
    assert get_actor_role() is None
