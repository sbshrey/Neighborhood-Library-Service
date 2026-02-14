# Neighborhood Library Service

A full‑stack take‑home implementation for managing books, users, and lending operations.

## Assumptions
- REST API is acceptable (gRPC optional).
- Each loan represents one book copy checked out by one user.
- `copies_available` is managed by the service and cannot fall below active loans.
- Books or users with active loans cannot be deleted.
- Users have a simple `role` field (`member`, `staff`, `admin`) for future access control.
- Book records can include optional `subject` and `rack_number` metadata for better in-library lookup.
- Circulation policy is configurable (max active loans per user, max loan days, overdue fine/day).
- Onboarding supports bulk import via CSV/XLSX for books, users, and loans.

## Tech Stack
- **Backend:** Python, FastAPI, SQLAlchemy, PostgreSQL, **uv** (package/runtime manager)
- **Frontend:** Next.js (React)

## Repository Layout
- `backend/` Python API server
- `frontend/` Next.js minimal UI

---

## Backend

### 1) Start local PostgreSQL (no Docker/Podman)
Ensure PostgreSQL is running on `localhost:5432` and create the DB/user:
```bash
psql -U postgres -h localhost -c "CREATE USER nls_user WITH PASSWORD '<your_local_password>';"
psql -U postgres -h localhost -c "CREATE DATABASE neighborhood_library OWNER nls_user;"
```

### 2) Install `uv` and backend dependencies
```bash
# macOS
brew install uv

cd backend
uv sync --group dev
```

### 3) Configure env
```bash
cp backend/.env.example backend/.env
```

### 4) Create tables (Alembic migrations)
```bash
cd backend
uv run alembic -c alembic.ini upgrade head
```

Recreate the database from scratch:
```bash
dropdb -h localhost -U postgres neighborhood_library
createdb -h localhost -U postgres neighborhood_library
cd backend
uv run alembic -c alembic.ini upgrade head
```

### 5) Run the API
```bash
export DATABASE_URL=postgresql+asyncpg://nls_user:<your_local_password>@localhost:5432/neighborhood_library
cd backend
uv run uvicorn app.main:app --reload
```

API docs: `http://localhost:8000/docs`

### Useful Endpoints
- `POST /auth/login`
- `GET /auth/me`
- `POST /books`
- `GET /books`
- `POST /users`
- `GET /users`
- `POST /loans/borrow`
- `POST /loans/{loan_id}/return`
- `GET /loans`
- `GET /books?subject=<value>&published_year=<year>`
- `GET /loans?overdue_only=true`
- `POST /imports/books` (CSV/XLSX upload)
- `POST /imports/users` (CSV/XLSX upload)
- `POST /imports/loans` (CSV/XLSX upload)

Most endpoints now require a Bearer JWT. Roles:
- `admin`: full access (admin settings, catalog/users management, imports, circulation)
- `staff`: circulation workflow (borrow/return/fines) + read-only data needed for desk operations
- `member`: not used in frontend portal (customer self-login intentionally disabled)

Login example:
```bash
EMAIL="<your_admin_email>"
PASSWORD="<your_admin_password>"
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"
```

Example borrow request:
```bash
TOKEN="<paste_access_token_here>"
curl -X POST http://localhost:8000/loans/borrow \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"book_id":1,"user_id":1,"days":14}'
```

Bulk import examples:
```bash
TOKEN="<admin_token>"
curl -X POST http://localhost:8000/imports/books \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@backend/data/seed_india/books.csv"

curl -X POST http://localhost:8000/imports/users \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@backend/data/seed_india/users.csv"

curl -X POST http://localhost:8000/imports/loans \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@backend/data/seed_india/loans.csv"
```

---

## Frontend

### 1) Install deps
```bash
cd frontend
npm install
```

### 2) Set API base
Create `frontend/.env.local`:
```bash
NEXT_PUBLIC_API_BASE=http://localhost:8000
```

### 3) Run
```bash
npm run dev
```

### Login
- Open `http://localhost:3000/login`
- On a fresh DB with zero users, enter Name/Email/Password and click **Bootstrap Admin (First Run)**.
- After bootstrap, use the same credentials to sign in.
- UI is staff/admin-only (customer/member self-login is intentionally not supported in this portal).
- Staff sees circulation workflow only (borrow/return/fines). Admin additionally sees **Admin Settings**.

### Playwright E2E Tests
Ensure the backend API is running and the frontend dev server is up.
```bash
cd frontend
npm install
npm run test:e2e:install
npm run test:e2e
```

If your frontend runs on a different URL:
```bash
E2E_BASE_URL=http://localhost:3000 npm run test:e2e
```

---

## Notes
- Error handling covers common edge cases (borrowing unavailable books, returning twice, deleting with active loans).
- CORS is configurable via `CORS_ORIGINS` in `backend/.env` (comma-separated list).
- Login endpoint rate limiting is configurable via:
  - `AUTH_LOGIN_RATE_LIMIT_PER_WINDOW`
  - `AUTH_LOGIN_RATE_LIMIT_WINDOW_SECONDS`
- Audit logs are emitted for mutating API calls and can be toggled with `AUDIT_LOG_ENABLED`.
- Circulation policy knobs:
  - `CIRCULATION_MAX_ACTIVE_LOANS_PER_USER`
  - `CIRCULATION_MAX_LOAN_DAYS`
  - `OVERDUE_FINE_PER_DAY`
- Curated onboarding CSV files are included in `backend/data/seed_india/` with Indian books/users and historical loan transactions.

## Tests (80%+ Coverage)
```bash
cd backend
uv run pytest
```

Coverage HTML report will be generated in `backend/htmlcov`.

## CI and Security
- GitHub Actions workflow (`.github/workflows/ci.yml`) runs backend tests and frontend build on push/PR.
- GitHub Actions workflow (`.github/workflows/secret-scan.yml`) runs Gitleaks on push/PR and daily schedule.

## What To Demo
1. Create a few books and users in the UI.
2. Borrow a book and see availability decrease.
3. Return the loan and see availability increase.
