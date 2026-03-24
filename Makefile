SHELL := /bin/zsh

.PHONY: up down logs test-backend test-frontend check-backend check-frontend check-docker check

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f

test-backend:
	cd backend && env UV_CACHE_DIR=/tmp/kincare-uv-cache uv run --no-project --with-requirements requirements-dev.txt pytest

test-frontend:
	cd frontend && npm test

check-backend:
	cd backend && env UV_CACHE_DIR=/tmp/kincare-uv-cache uv run --no-project --with-requirements requirements-dev.txt pytest

check-frontend:
	cd frontend && npm ci && npm test && npm run build

check-docker:
	docker compose build api web

check: check-backend check-frontend check-docker
