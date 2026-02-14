import pytest


@pytest.mark.asyncio
async def test_book_crud(client, auth_headers):
    create = await client.post(
        "/books",
        json={
            "title": "The Pragmatic Programmer",
            "author": "Andrew Hunt",
            "isbn": "9780201616224",
            "published_year": 1999,
            "copies_total": 2,
        },
        headers=auth_headers,
    )
    assert create.status_code == 201
    book = create.json()
    assert book["copies_available"] == 2

    listed = await client.get("/books", headers=auth_headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    fetched = await client.get(f"/books/{book['id']}", headers=auth_headers)
    assert fetched.status_code == 200
    assert fetched.json()["title"] == "The Pragmatic Programmer"

    update = await client.patch(
        f"/books/{book['id']}",
        json={"copies_total": 3},
        headers=auth_headers,
    )
    assert update.status_code == 200
    updated = update.json()
    assert updated["copies_total"] == 3
    assert updated["copies_available"] == 3


@pytest.mark.asyncio
async def test_book_search(client, auth_headers):
    await client.post(
        "/books",
        json={
            "title": "Clean Code",
            "author": "Robert C. Martin",
            "isbn": "9780132350884",
            "published_year": 2008,
            "copies_total": 1,
        },
        headers=auth_headers,
    )
    await client.post(
        "/books",
        json={
            "title": "Clean Architecture",
            "author": "Robert C. Martin",
            "isbn": "9780134494166",
            "published_year": 2017,
            "copies_total": 1,
        },
        headers=auth_headers,
    )

    resp = await client.get("/books?q=Architecture", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["title"] == "Clean Architecture"
