#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
FRONTEND_DIR="${ROOT_DIR}/frontend"
LOG_DIR="${ROOT_DIR}/.run-logs"
export UV_CACHE_DIR="${UV_CACHE_DIR:-${ROOT_DIR}/.uv-cache}"

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
API_BASE="http://${BACKEND_HOST}:${BACKEND_PORT}"
WEB_BASE="http://${FRONTEND_HOST}:${FRONTEND_PORT}"

RUN_BACKEND=1
RUN_FRONTEND=1
INSTALL_DEPS=1
RUN_MIGRATIONS=1
RUN_E2E=0
E2E_VISUAL=0
KEEP_RUNNING_AFTER_E2E=0

STARTED_BACKEND=0
STARTED_FRONTEND=0
BACKEND_PID=""
FRONTEND_PID=""

usage() {
  cat <<EOF
Usage: ./start.sh [options]

Options:
  --skip-install        Skip dependency installation (uv sync / npm install)
  --skip-migrate        Skip Alembic migrations
  --backend-only        Start only backend
  --frontend-only       Start only frontend
  --with-e2e            Run Playwright tests after services are healthy
  --with-e2e-visual     Run headed Playwright visual tests
  --keep-running        Keep services running after Playwright completes
  -h, --help            Show this help

Environment overrides:
  BACKEND_HOST, BACKEND_PORT, FRONTEND_HOST, FRONTEND_PORT
  NEXT_PUBLIC_API_BASE, E2E_BASE_URL, E2E_API_BASE
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-install)
      INSTALL_DEPS=0
      shift
      ;;
    --skip-migrate)
      RUN_MIGRATIONS=0
      shift
      ;;
    --backend-only)
      RUN_BACKEND=1
      RUN_FRONTEND=0
      shift
      ;;
    --frontend-only)
      RUN_BACKEND=0
      RUN_FRONTEND=1
      RUN_MIGRATIONS=0
      shift
      ;;
    --with-e2e)
      RUN_E2E=1
      E2E_VISUAL=0
      shift
      ;;
    --with-e2e-visual)
      RUN_E2E=1
      E2E_VISUAL=1
      shift
      ;;
    --keep-running)
      KEEP_RUNNING_AFTER_E2E=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo
      usage
      exit 1
      ;;
  esac
done

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

wait_for_http() {
  local url="$1"
  local name="$2"
  local attempts="${3:-60}"
  local delay_seconds="${4:-1}"
  local i
  for ((i=1; i<=attempts; i+=1)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "[ok] ${name} is healthy at ${url}"
      return 0
    fi
    sleep "${delay_seconds}"
  done
  echo "[error] ${name} did not become healthy at ${url}"
  return 1
}

ensure_healthy_or_exit() {
  local url="$1"
  local name="$2"
  local log_file="$3"
  if ! wait_for_http "$url" "$name"; then
    if [[ -f "$log_file" ]]; then
      echo
      echo "[diagnostic] Last 60 lines from ${log_file}:"
      tail -n 60 "$log_file" || true
    fi
    exit 1
  fi
}

port_in_use() {
  local host="$1"
  local port="$2"
  python - "$host" "$port" <<'PY'
import socket, sys
host = sys.argv[1]
port = int(sys.argv[2])
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(0.3)
result = s.connect_ex((host, port))
s.close()
sys.exit(0 if result == 0 else 1)
PY
}

cleanup() {
  local exit_code=$?
  if [[ "${STARTED_FRONTEND}" -eq 1 ]] && [[ -n "${FRONTEND_PID}" ]] && kill -0 "${FRONTEND_PID}" >/dev/null 2>&1; then
    kill "${FRONTEND_PID}" >/dev/null 2>&1 || true
  fi
  if [[ "${STARTED_BACKEND}" -eq 1 ]] && [[ -n "${BACKEND_PID}" ]] && kill -0 "${BACKEND_PID}" >/dev/null 2>&1; then
    kill "${BACKEND_PID}" >/dev/null 2>&1 || true
  fi
  exit "${exit_code}"
}

trap cleanup EXIT INT TERM

need_cmd python
need_cmd curl
if [[ "${RUN_BACKEND}" -eq 1 ]]; then
  need_cmd uv
fi
if [[ "${RUN_FRONTEND}" -eq 1 ]] || [[ "${RUN_E2E}" -eq 1 ]]; then
  need_cmd npm
fi

mkdir -p "${LOG_DIR}"
mkdir -p "${UV_CACHE_DIR}"

if [[ "${INSTALL_DEPS}" -eq 1 ]]; then
  if [[ "${RUN_BACKEND}" -eq 1 ]]; then
    echo "[setup] Installing backend dependencies with uv..."
    (cd "${BACKEND_DIR}" && uv sync --group dev)
  fi
  if [[ "${RUN_FRONTEND}" -eq 1 ]] || [[ "${RUN_E2E}" -eq 1 ]]; then
    echo "[setup] Installing frontend dependencies..."
    (cd "${FRONTEND_DIR}" && npm install)
  fi
fi

if [[ "${RUN_BACKEND}" -eq 1 ]] && [[ "${RUN_MIGRATIONS}" -eq 1 ]]; then
  echo "[setup] Running backend migrations..."
  (cd "${BACKEND_DIR}" && uv run alembic -c alembic.ini upgrade head)
fi

if [[ "${RUN_BACKEND}" -eq 1 ]]; then
  if port_in_use "${BACKEND_HOST}" "${BACKEND_PORT}"; then
    echo "[warn] Backend port ${BACKEND_HOST}:${BACKEND_PORT} already in use; reusing existing service."
  else
    echo "[run] Starting backend on ${BACKEND_HOST}:${BACKEND_PORT}..."
    (
      cd "${BACKEND_DIR}"
      uv run uvicorn app.main:app --host "${BACKEND_HOST}" --port "${BACKEND_PORT}" --reload \
        > "${LOG_DIR}/backend.log" 2>&1
    ) &
    BACKEND_PID=$!
    STARTED_BACKEND=1
  fi
fi

if [[ "${RUN_FRONTEND}" -eq 1 ]]; then
  export NEXT_PUBLIC_API_BASE="${NEXT_PUBLIC_API_BASE:-${API_BASE}}"
  if port_in_use "${FRONTEND_HOST}" "${FRONTEND_PORT}"; then
    echo "[warn] Frontend port ${FRONTEND_HOST}:${FRONTEND_PORT} already in use; reusing existing service."
  else
    echo "[run] Starting frontend on ${FRONTEND_HOST}:${FRONTEND_PORT}..."
    (
      cd "${FRONTEND_DIR}"
      npm run dev -- -H "${FRONTEND_HOST}" -p "${FRONTEND_PORT}" > "${LOG_DIR}/frontend.log" 2>&1
    ) &
    FRONTEND_PID=$!
    STARTED_FRONTEND=1
  fi
fi

if [[ "${RUN_BACKEND}" -eq 1 ]] || [[ "${RUN_E2E}" -eq 1 ]]; then
  ensure_healthy_or_exit "${API_BASE}/health" "Backend API" "${LOG_DIR}/backend.log"
fi

if [[ "${RUN_FRONTEND}" -eq 1 ]] || [[ "${RUN_E2E}" -eq 1 ]]; then
  ensure_healthy_or_exit "${WEB_BASE}/login" "Frontend UI" "${LOG_DIR}/frontend.log"
fi

echo
echo "[ready] Backend:  ${API_BASE}"
echo "[ready] Frontend: ${WEB_BASE}"
echo "[logs] backend:  ${LOG_DIR}/backend.log"
echo "[logs] frontend: ${LOG_DIR}/frontend.log"
echo

if [[ "${RUN_E2E}" -eq 1 ]]; then
  export E2E_BASE_URL="${E2E_BASE_URL:-${WEB_BASE}}"
  export E2E_API_BASE="${E2E_API_BASE:-${API_BASE}}"
  echo "[test] Running Playwright tests..."
  if [[ "${E2E_VISUAL}" -eq 1 ]]; then
    (cd "${FRONTEND_DIR}" && npm run test:e2e:visual)
  else
    (cd "${FRONTEND_DIR}" && npm run test:e2e)
  fi
  echo "[test] Playwright run completed."
  echo

  if [[ "${KEEP_RUNNING_AFTER_E2E}" -eq 0 ]]; then
    echo "[done] Exiting after test run."
    exit 0
  fi
fi

if [[ "${STARTED_BACKEND}" -eq 1 ]] || [[ "${STARTED_FRONTEND}" -eq 1 ]]; then
  echo "Press Ctrl+C to stop started services."
  while true; do
    sleep 3600
  done
fi

echo "[done] Nothing to stop. Existing services were reused."
