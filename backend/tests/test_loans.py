import pytest


@pytest.mark.asyncio
async def test_borrow_and_return_flow(client, auth_headers):
    book_resp = await client.post(
        "/books",
        json={
            "title": "Designing Data-Intensive Applications",
            "author": "Martin Kleppmann",
            "isbn": "9781449373320",
            "published_year": 2017,
            "copies_total": 1,
        },
        headers=auth_headers,
    )
    user_resp = await client.post(
        "/users",
        json={"name": "Linus Torvalds", "email": "linus@example.com"},
        headers=auth_headers,
    )
    book = book_resp.json()
    user = user_resp.json()

    borrow = await client.post(
        "/loans/borrow",
        json={"book_id": book["id"], "user_id": user["id"], "days": 7},
        headers=auth_headers,
    )
    assert borrow.status_code == 201
    loan = borrow.json()

    unavailable = await client.post(
        "/loans/borrow",
        json={"book_id": book["id"], "user_id": user["id"], "days": 7},
        headers=auth_headers,
    )
    assert unavailable.status_code == 400

    borrowed_list = await client.get(f"/users/{user['id']}/borrowed", headers=auth_headers)
    assert borrowed_list.status_code == 200
    assert len(borrowed_list.json()) == 1

    active_loans = await client.get("/loans?active=true", headers=auth_headers)
    assert active_loans.status_code == 200
    assert len(active_loans.json()) == 1

    returned = await client.post(f"/loans/{loan['id']}/return", headers=auth_headers)
    assert returned.status_code == 200

    double_return = await client.post(f"/loans/{loan['id']}/return", headers=auth_headers)
    assert double_return.status_code == 400

    available_books = await client.get("/books", headers=auth_headers)
    assert available_books.json()[0]["copies_available"] == 1


@pytest.mark.asyncio
async def test_delete_constraints(client, auth_headers):
    book_resp = await client.post(
        "/books",
        json={
            "title": "Refactoring",
            "author": "Martin Fowler",
            "copies_total": 1,
        },
        headers=auth_headers,
    )
    user_resp = await client.post(
        "/users",
        json={"name": "Kent Beck"},
        headers=auth_headers,
    )
    book = book_resp.json()
    user = user_resp.json()

    loan_resp = await client.post(
        "/loans/borrow",
        json={"book_id": book["id"], "user_id": user["id"], "days": 14},
        headers=auth_headers,
    )
    assert loan_resp.status_code == 201

    delete_book = await client.delete(f"/books/{book['id']}", headers=auth_headers)
    assert delete_book.status_code == 400

    delete_user = await client.delete(f"/users/{user['id']}", headers=auth_headers)
    assert delete_user.status_code == 400
