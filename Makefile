SHELL := /bin/bash
.DEFAULT_GOAL := help

.PHONY: help install install-backend install-frontend migrate backend frontend up up-fast up-e2e up-e2e-visual test-backend test-e2e test-e2e-visual precommit-install precommit report clean reset-db rebuild-db

DB_HOST ?= localhost
DB_PORT ?= 5432
DB_NAME ?= neighborhood_library
DB_ADMIN_USER ?= postgres

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*## "}; /^[a-zA-Z0-9_-]+:.*## / {printf "%s\t- %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install-backend: ## Install backend dependencies (uv)
	cd backend && uv sync --group dev

install-frontend: ## Install frontend dependencies (npm)
	cd frontend && npm install

install: install-backend install-frontend ## Install all dependencies

migrate: ## Run backend migrations
	cd backend && uv run alembic -c alembic.ini upgrade head

backend: ## Start backend only
	./start.sh --backend-only

frontend: ## Start frontend only
	./start.sh --frontend-only

up: ## Install, migrate, and start backend + frontend
	./start.sh

up-fast: ## Start backend + frontend (skip install + migrations)
	./start.sh --skip-install --skip-migrate

up-e2e: ## Start stack and run Playwright tests
	./start.sh --with-e2e

up-e2e-visual: ## Start stack and run headed Playwright demo tests
	./start.sh --with-e2e-visual

test-backend: ## Run backend tests with coverage
	cd backend && uv run pytest

test-e2e: ## Run Playwright tests (expects services already running)
	cd frontend && npm run test:e2e

test-e2e-visual: ## Run headed Playwright visual tests
	cd frontend && npm run test:e2e:visual

precommit-install: ## Install local git pre-commit hooks
	uvx pre-commit install

precommit: ## Run pre-commit hooks on all files
	uvx pre-commit run --all-files

report: ## Open Playwright HTML report
	cd frontend && npm run test:e2e:report

clean: ## Remove local build/test/cache artifacts
	rm -rf backend/.pytest_cache backend/htmlcov backend/.coverage \
		frontend/.next frontend/test-results frontend/playwright-report \
		.run-logs .uv-cache

reset-db: ## Drop+recreate local Postgres DB and run migrations (requires CONFIRM=YES)
	@if [ "$$CONFIRM" != "YES" ]; then \
		echo "Refusing to reset DB. Re-run with: make reset-db CONFIRM=YES"; \
		exit 1; \
	fi
	dropdb --if-exists -h $(DB_HOST) -p $(DB_PORT) -U $(DB_ADMIN_USER) $(DB_NAME)
	createdb -h $(DB_HOST) -p $(DB_PORT) -U $(DB_ADMIN_USER) $(DB_NAME)
	$(MAKE) migrate

rebuild-db: clean reset-db ## Clean artifacts and recreate DB from scratch (CONFIRM=YES required)
