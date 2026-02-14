from datetime import datetime

import pytest


async def _create_book(client, auth_headers, title="Edge Book", copies=1):
    response = await client.post(
        "/books",
        json={"title": title, "author": "Edge Author", "copies_total": copies},
        headers=auth_headers,
    )
    assert response.status_code == 201
    return response.json()


async def _create_user(client, auth_headers, name, email):
    response = await client.post(
        "/users",
        json={"name": name, "email": email, "password": "member-pass-123"},
        headers=auth_headers,
    )
    assert response.status_code == 201
    return response.json()


@pytest.mark.asyncio
async def test_loan_router_error_paths(client, auth_headers):
    book = await _create_book(client, auth_headers)

    missing_user = await client.post(
        "/loans/borrow",
        json={"book_id": book["id"], "user_id": 9999, "days": 7},
        headers=auth_headers,
    )
    assert missing_user.status_code == 404
    assert missing_user.json()["detail"] == "User not found"

    user = await _create_user(client, auth_headers, "Edge User", "edge-user@test.dev")
    missing_book = await client.post(
        "/loans/borrow",
        json={"book_id": 9999, "user_id": user["id"], "days": 7},
        headers=auth_headers,
    )
    assert missing_book.status_code == 404
    assert missing_book.json()["detail"] == "Book not found"

    missing_loan = await client.post("/loans/99999/return", headers=auth_headers)
    assert missing_loan.status_code == 404
    assert missing_loan.json()["detail"] == "Loan not found"


@pytest.mark.asyncio
async def test_loan_update_delete_and_filters(client, auth_headers):
    book = await _create_book(client, auth_headers, title="Filter Book", copies=2)
    user = await _create_user(client, auth_headers, "Filter User", "filter-user@test.dev")

    loan_one_resp = await client.post(
        "/loans/borrow",
        json={"book_id": book["id"], "user_id": user["id"], "days": 7},
        headers=auth_headers,
    )
    assert loan_one_resp.status_code == 201
    loan_one = loan_one_resp.json()
    due_before = datetime.fromisoformat(loan_one["due_at"])

    loan_two_resp = await client.post(
        "/loans/borrow",
        json={"book_id": book["id"], "user_id": user["id"], "days": 10},
        headers=auth_headers,
    )
    assert loan_two_resp.status_code == 201
    loan_two = loan_two_resp.json()

    by_user = await client.get(f"/loans?user_id={user['id']}", headers=auth_headers)
    assert by_user.status_code == 200
    assert len(by_user.json()) == 2

    by_book = await client.get(f"/loans?book_id={book['id']}", headers=auth_headers)
    assert by_book.status_code == 200
    assert len(by_book.json()) == 2

    extended = await client.patch(
        f"/loans/{loan_one['id']}",
        json={"extend_days": 3},
        headers=auth_headers,
    )
    assert extended.status_code == 200
    due_after = datetime.fromisoformat(extended.json()["due_at"])
    assert due_after > due_before

    returned = await client.post(f"/loans/{loan_one['id']}/return", headers=auth_headers)
    assert returned.status_code == 200

    returned_edit = await client.patch(
        f"/loans/{loan_one['id']}",
        json={"extend_days": 1},
        headers=auth_headers,
    )
    assert returned_edit.status_code == 400
    assert returned_edit.json()["detail"] == "Returned loan cannot be edited"

    delete_active = await client.delete(f"/loans/{loan_two['id']}", headers=auth_headers)
    assert delete_active.status_code == 204

    books_after = await client.get("/books", headers=auth_headers)
    assert books_after.status_code == 200
    assert books_after.json()[0]["copies_available"] == 2

    inactive = await client.get("/loans?active=false", headers=auth_headers)
    assert inactive.status_code == 200
    assert len(inactive.json()) == 1

    overdue = await client.get("/loans?overdue_only=true", headers=auth_headers)
    assert overdue.status_code == 200
    assert len(overdue.json()) == 0

    delete_returned = await client.delete(f"/loans/{loan_one['id']}", headers=auth_headers)
    assert delete_returned.status_code == 204

    missing_delete = await client.delete("/loans/99999", headers=auth_headers)
    assert missing_delete.status_code == 404


@pytest.mark.asyncio
async def test_loan_policy_limits_and_overdue_fields(client, auth_headers):
    user = await _create_user(client, auth_headers, "Policy User", "policy-user@test.dev")

    book_ids: list[int] = []
    for index in range(6):
        book = await _create_book(client, auth_headers, title=f"Policy Book {index + 1}", copies=1)
        book_ids.append(book["id"])

    for book_id in book_ids[:5]:
        borrow = await client.post(
            "/loans/borrow",
            json={"book_id": book_id, "user_id": user["id"], "days": 7},
            headers=auth_headers,
        )
        assert borrow.status_code == 201

    over_limit = await client.post(
        "/loans/borrow",
        json={"book_id": book_ids[5], "user_id": user["id"], "days": 7},
        headers=auth_headers,
    )
    assert over_limit.status_code == 400
    assert "maximum active loans limit" in over_limit.json()["detail"]

    too_many_days = await client.post(
        "/loans/borrow",
        json={"book_id": book_ids[5], "user_id": user["id"], "days": 22},
        headers=auth_headers,
    )
    assert too_many_days.status_code == 400
    assert too_many_days.json()["detail"] == "Loan days cannot exceed 21 days"

    listed = await client.get("/loans?active=true", headers=auth_headers)
    assert listed.status_code == 200
    first = listed.json()[0]
    assert "estimated_fine" in first
    assert "overdue_days" in first
    assert "is_overdue" in first
