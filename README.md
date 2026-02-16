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

## Prerequisites
- Node.js `>=20.19` (or `>=22.12`) and npm
- Python `>=3.10,<3.12`
- PostgreSQL on `localhost:5432`
- `uv` package manager

## Repository Layout
- `backend/` Python API server
- `frontend/` Next.js minimal UI

---

## Fast Setup (Fresh Clone)
From repo root:
```bash
make install
make migrate
make up
```

For a fully clean DB reset:
```bash
PGPASSWORD=<postgres_password> make reset-db CONFIRM=YES
```

## Quick Start Script
From repo root:
```bash
./start.sh
```

With Makefile shortcuts:
```bash
make help
make up
```

Common variants:
```bash
# run all + playwright
./start.sh --with-e2e

# run all + headed visual demo tests
./start.sh --with-e2e-visual

# run only backend
./start.sh --backend-only

# skip dependency install and migrations
./start.sh --skip-install --skip-migrate
```

Make equivalents:
```bash
make up-e2e
make up-e2e-visual
make backend
make up-fast
make test-backend
make test-frontend-unit
make test-frontend-coverage
make test-e2e
make precommit
make clean
make reset-db CONFIRM=YES
```

Script logs are written to:
- `.run-logs/backend.log`
- `.run-logs/frontend.log`

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
PGPASSWORD=<postgres_password> dropdb -h localhost -U postgres neighborhood_library
PGPASSWORD=<postgres_password> createdb -h localhost -U postgres neighborhood_library
cd backend
uv run alembic -c alembic.ini upgrade head
```

or with Make:
```bash
PGPASSWORD=<postgres_password> make reset-db CONFIRM=YES
```

If your local Postgres trusts local connections, `PGPASSWORD` may not be required.

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
- `GET /users/me/loans`
- `GET /users/me/fine-payments`
- `POST /books`
- `GET /books`
- `POST /users`
- `GET /users`
- `POST /loans/borrow`
- `POST /loans/{loan_id}/return`
- `GET /loans`
- `GET /loans/{loan_id}/fine-summary`
- `GET /loans/{loan_id}/fine-payments`
- `POST /loans/{loan_id}/fine-payments`
- `GET /books?subject=<value>&published_year=<year>`
- `GET /loans?overdue_only=true`
- `POST /imports/books` (CSV/XLSX upload)
- `POST /imports/users` (CSV/XLSX upload)
- `POST /imports/loans` (CSV/XLSX upload)
- Imports are idempotent: existing rows are skipped and only new rows are inserted.

Most endpoints now require a Bearer JWT. Roles:
- `admin`: full access (admin settings, catalog/users management, imports, circulation)
- `staff`: circulation workflow (borrow/return/fines) + read-only data needed for desk operations
- `member`: self-service view for own borrowing history, returns, and fines
  - includes fine payment history with payment mode and references

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
- Staff sees circulation workflow only (borrow/return/fines). Admin additionally sees **Admin Settings**.
- Members can sign in and are routed to `/member` for self-service loan/fine tracking.

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

If API is not on `:8000`:
```bash
E2E_API_BASE=http://localhost:8000 npm run test:e2e
```

Bootstrap-aware admin creds for first run or existing setup:
```bash
E2E_ADMIN_NAME="E2E Admin" \
E2E_ADMIN_EMAIL="admin@example.com" \
E2E_ADMIN_PASSWORD="Admin@12345" \
E2E_EXISTING_ADMIN_EMAIL="existing-admin@example.com" \
E2E_EXISTING_ADMIN_PASSWORD="Existing@12345" \
npm run test:e2e
```

Visual demo mode (headed + video + screenshots + trace):
```bash
npm run test:e2e:visual
```

### Frontend Unit Tests + Coverage (Vitest)
```bash
cd frontend
npm run test:unit
npm run test:coverage
```

Coverage output is generated at:
- `frontend/coverage/index.html`

---

## Notes
- Error handling covers common edge cases (borrowing unavailable books, returning twice, deleting with active loans).
- CORS is configurable via `CORS_ORIGINS` in `backend/.env` (comma-separated list).
- Login endpoint rate limiting is configurable via:
  - `AUTH_LOGIN_RATE_LIMIT_PER_WINDOW`
  - `AUTH_LOGIN_RATE_LIMIT_WINDOW_SECONDS`
- Audit logs are emitted for mutating API calls and can be toggled with `AUDIT_LOG_ENABLED`.
- API response caching currently uses in-memory process-local storage (good for local/demo runs).
  For multi-instance production deployments, use a shared cache like Redis to avoid stale/uneven cache behavior across nodes.
- Frontend currently uses explicit fetch hooks/state instead of TanStack Query to keep take-home complexity controlled.
  If this were extended to production scale, migrating API data flows to TanStack Query would improve cache invalidation, refetch, and loading/error consistency.
- Circulation policy knobs:
  - `CIRCULATION_MAX_ACTIVE_LOANS_PER_USER`
  - `CIRCULATION_MAX_LOAN_DAYS`
  - `OVERDUE_FINE_PER_DAY`
- Curated onboarding CSV files are included in `backend/data/seed_india/` with Indian books/users and historical loan transactions.
- Fine payment modes supported: `cash`, `upi`, `card`, `net_banking`, `wallet`, `waiver`, `adjustment`.

## Tests (80%+ Coverage)
```bash
cd backend
uv run pytest
```

## Pre-Commit Hooks
Install local hooks:
```bash
uvx pre-commit install
```

Run all hooks manually:
```bash
uvx pre-commit run --all-files
```

Makefile shortcuts:
```bash
make precommit-install
make precommit
```

Coverage HTML report will be generated in `backend/htmlcov`.

## CI and Security
- GitHub Actions workflow (`.github/workflows/ci.yml`) runs:
  - pre-commit hooks on all files
  - backend tests + coverage gate
  - frontend build
- Optional Playwright smoke test can be triggered manually via **Actions → CI → Run workflow** and enabling `run_e2e_smoke`.
- GitHub Actions workflow (`.github/workflows/secret-scan.yml`) runs Gitleaks on push/PR and daily schedule.

## What To Demo
1. Create a few books and users in the UI.
2. Borrow a book and see availability decrease.
3. Return the loan and see availability increase.
