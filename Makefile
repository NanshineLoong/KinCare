up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f

test-backend:
	cd backend && env UV_CACHE_DIR=/tmp/uv-cache uv run --with pytest --with fastapi --with httpx pytest tests/test_health.py

test-frontend:
	cd frontend && npm test
