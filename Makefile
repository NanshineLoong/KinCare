SHELL := /bin/sh

.PHONY: up down logs test-backend test-frontend check-backend check-frontend check-docker check

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f

test-backend:
	cd backend && python3 -m venv --clear /tmp/kincare-check-backend-venv && /tmp/kincare-check-backend-venv/bin/pip install -r requirements-dev.txt pytest && /tmp/kincare-check-backend-venv/bin/pytest

test-frontend:
	cd frontend && npm test

check-backend:
	cd backend && python3 -m venv --clear /tmp/kincare-check-backend-venv && /tmp/kincare-check-backend-venv/bin/pip install -r requirements-dev.txt pytest && /tmp/kincare-check-backend-venv/bin/pytest

check-frontend:
	cd frontend && npm ci && npm test && npm run build

check-docker:
	docker compose build api web

check: check-backend check-frontend check-docker
