import io

import pytest
from openpyxl import Workbook


@pytest.mark.asyncio
async def test_bulk_import_csv_endpoints(client, auth_headers):
    books_csv = (
        "title,author,subject,rack_number,isbn,published_year,copies_total\n"
        "Ponniyin Selvan,Kalki Krishnamurthy,Historical Fiction,IND-H-21,9780143422621,1955,2\n"
    )
    users_csv = (
        "name,email,phone,role,password\n"
        "Devika Rao,devika.rao@library.dev,+91-98000-12345,member,Member@12345\n"
    )
    loans_csv = (
        "book_isbn,user_email,days,borrowed_at,due_at,returned_at\n"
        "9780143422621,devika.rao@library.dev,7,2026-02-01T10:00:00+05:30,2026-02-08T10:00:00+05:30,\n"
    )

    books_resp = await client.post(
        "/imports/books",
        files={"file": ("books.csv", books_csv, "text/csv")},
        headers=auth_headers,
    )
    assert books_resp.status_code == 200
    assert books_resp.json()["imported"] == 1

    users_resp = await client.post(
        "/imports/users",
        files={"file": ("users.csv", users_csv, "text/csv")},
        headers=auth_headers,
    )
    assert users_resp.status_code == 200
    assert users_resp.json()["imported"] == 1

    loans_resp = await client.post(
        "/imports/loans",
        files={"file": ("loans.csv", loans_csv, "text/csv")},
        headers=auth_headers,
    )
    assert loans_resp.status_code == 200
    assert loans_resp.json()["imported"] == 1

    books_dup = await client.post(
        "/imports/books",
        files={"file": ("books.csv", books_csv, "text/csv")},
        headers=auth_headers,
    )
    assert books_dup.status_code == 200
    assert books_dup.json()["imported"] == 0
    assert books_dup.json()["skipped"] == 1

    users_dup = await client.post(
        "/imports/users",
        files={"file": ("users.csv", users_csv, "text/csv")},
        headers=auth_headers,
    )
    assert users_dup.status_code == 200
    assert users_dup.json()["imported"] == 0
    assert users_dup.json()["skipped"] == 1

    loans_dup = await client.post(
        "/imports/loans",
        files={"file": ("loans.csv", loans_csv, "text/csv")},
        headers=auth_headers,
    )
    assert loans_dup.status_code == 200
    assert loans_dup.json()["imported"] == 0
    assert loans_dup.json()["skipped"] == 1

    listed_loans = await client.get("/loans?active=true", headers=auth_headers)
    assert listed_loans.status_code == 200
    assert listed_loans.json()[0]["overdue_days"] >= 0


@pytest.mark.asyncio
async def test_bulk_import_books_xlsx(client, auth_headers):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "books"
    sheet.append(
        ["title", "author", "subject", "rack_number", "isbn", "published_year", "copies_total"]
    )
    sheet.append(
        [
            "The Palace of Illusions",
            "Chitra Banerjee Divakaruni",
            "Mythological Fiction",
            "IND-M-14",
            "9780307275510",
            2008,
            2,
        ]
    )

    buffer = io.BytesIO()
    workbook.save(buffer)
    buffer.seek(0)

    response = await client.post(
        "/imports/books",
        files={
            "file": (
                "books.xlsx",
                buffer.getvalue(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
        headers=auth_headers,
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["imported"] == 1
    assert payload["errors"] == []
