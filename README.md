# Neighborhood Library Service

A full‑stack take‑home implementation for managing books, users, and lending operations.

## Assumptions
- REST API is acceptable (gRPC optional).
- Each loan represents one book copy checked out by one user.
- `copies_available` is managed by the service and cannot fall below active loans.
- Books or users with active loans cannot be deleted.
- Users have a simple `role` field (`member`, `staff`, `admin`) for future access control.

## Tech Stack
- **Backend:** Python, FastAPI, SQLAlchemy, PostgreSQL
- **Frontend:** Next.js (React)

## Repository Layout
- `backend/` Python API server
- `frontend/` Next.js minimal UI
- `docker-compose.yml` local PostgreSQL

---

## Backend

### 1) Start Postgres

**Docker**
```bash
docker compose up -d
```

**Podman (preferred if you already have Podman installed)**
```bash
# macOS only
podman machine start

# Compose compatible
podman compose up -d
```

If `podman compose` is not available, install `podman-compose` and run:
```bash
podman-compose up -d
```

If you don’t want to install a compose provider, run PostgreSQL directly:
```bash
podman run -d --name nls-postgres \
  -e POSTGRES_DB=neighborhood_library \
  -e POSTGRES_USER=nls_user \
  -e POSTGRES_PASSWORD=<your_local_password> \
  -p 5432:5432 \
  -v nls_pgdata:/var/lib/postgresql/data \
  docker.io/library/postgres:15
```

To stop/remove it later:
```bash
podman stop nls-postgres
podman rm nls-postgres
```

### 2) Create a virtualenv and install deps
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

### 3) Configure env
```bash
cp backend/.env.example backend/.env
```

### 4) Create tables (Alembic migrations)
```bash
PYTHONPATH=backend alembic -c backend/alembic.ini upgrade head
```

Recreate the database from scratch:
```bash
dropdb -h localhost -U postgres neighborhood_library
createdb -h localhost -U postgres neighborhood_library
PYTHONPATH=backend alembic -c backend/alembic.ini upgrade head
```

### 5) Run the API
```bash
export DATABASE_URL=postgresql+asyncpg://nls_user:<your_local_password>@localhost:5432/neighborhood_library
PYTHONPATH=backend uvicorn app.main:app --reload
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

Most endpoints now require a Bearer JWT. Roles:
- `admin`: full access (users/seed/catalog/loans)
- `staff`: catalog + loans read/write
- `member`: limited read/self endpoints

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

## Tests (80%+ Coverage)
```bash
cd backend
PYTHONPATH=../backend pytest
```

Coverage HTML report will be generated in `backend/htmlcov`.

## CI and Security
- GitHub Actions workflow (`.github/workflows/ci.yml`) runs backend tests and frontend build on push/PR.
- GitHub Actions workflow (`.github/workflows/secret-scan.yml`) runs Gitleaks on push/PR and daily schedule.

## What To Demo
1. Create a few books and users in the UI.
2. Borrow a book and see availability decrease.
3. Return the loan and see availability increase.
