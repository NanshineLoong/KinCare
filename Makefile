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
