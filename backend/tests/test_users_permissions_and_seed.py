import pytest

from app.utils.sample_data import seed_sample_data


from tests.constants import TEST_AUTH_VALUE
@pytest.mark.asyncio
async def test_seed_sample_data_created_then_skipped(db_session):
    created = await seed_sample_data(db_session)
    assert created["status"] == "created"
    assert created["counts"]["books"] > 0
    assert created["counts"]["users"] > 0
    assert created["counts"]["loans"] > 0

    skipped = await seed_sample_data(db_session)
    assert skipped["status"] == "skipped"


@pytest.mark.asyncio
async def test_users_me_and_borrowed_permissions(client, auth_headers):
    admin_me = await client.get("/users/me", headers=auth_headers)
    assert admin_me.status_code == 200
    assert admin_me.json()["role"] == "admin"

    member_one = await client.post(
        "/users",
        json={
            "name": "Member One",
            "email": "member-one@test.dev",
            "role": "member",
            "password": TEST_AUTH_VALUE,
        },
        headers=auth_headers,
    )
    assert member_one.status_code == 201

    member_two = await client.post(
        "/users",
        json={
            "name": "Member Two",
            "email": "member-two@test.dev",
            "role": "member",
            "password": TEST_AUTH_VALUE,
        },
        headers=auth_headers,
    )
    assert member_two.status_code == 201

    book = await client.post(
        "/books",
        json={"title": "Permission Book", "author": "Perm Author", "copies_total": 1},
        headers=auth_headers,
    )
    assert book.status_code == 201

    loan = await client.post(
        "/loans/borrow",
        json={"book_id": book.json()["id"], "user_id": member_one.json()["id"], "days": 7},
        headers=auth_headers,
    )
    assert loan.status_code == 201

    login_member_two = await client.post(
        "/auth/login",
        json={"email": "member-two@test.dev", "password": TEST_AUTH_VALUE},
    )
    assert login_member_two.status_code == 200
    member_two_headers = {
        "Authorization": f"Bearer {login_member_two.json()['access_token']}"
    }

    forbidden = await client.get(
        f"/users/{member_one.json()['id']}/borrowed",
        headers=member_two_headers,
    )
    assert forbidden.status_code == 403

    not_found = await client.get("/users/999999/borrowed", headers=auth_headers)
    assert not_found.status_code == 404
