# KinCare Docker Compose Deployment Design

## Background

KinCare's current codebase is already aligned with a single-instance, single-household runtime:

- The backend is a single FastAPI process with SQLite, an in-process scheduler, and in-app AI runtime.
- The frontend is a React + Vite SPA.
- The active architecture documents explicitly keep SQLite as the current baseline runtime.
- The repository already contains `docker-compose.yml` and multiple Dockerfiles, but they still behave like scaffolding rather than a release-ready installation path.

The current gap is not "whether Docker exists", but that the Docker path is not yet productized:

- the frontend image still runs the Vite dev server
- the default Compose file does not model readiness with health checks
- the current environment template exposes internal wiring and stale PostgreSQL-oriented variables
- Docker is still documented as a future-facing skeleton rather than the official install path

## Goal

Turn Docker Compose into KinCare's first official end-user deployment path for self-hosted single-machine installs.

This release should let a user:

1. copy `.env.example` to `.env`
2. fill the minimum required secrets and AI settings
3. run `docker compose up -d`
4. open a single web URL and use the app

## Non-Goals

This design intentionally does not cover:

- development-time Docker hot reload
- multi-instance or horizontally scaled deployments
- PostgreSQL as the default or required database
- Kubernetes, Helm, or serverless deployment targets
- turning the current MCP placeholder into a required production service
- a long-term attachment storage subsystem, because the current implementation parses uploads transiently and does not persist original files

## Product Decision

### Official Deployment Path

KinCare will officially support one end-user deployment path in the near term:

- single-machine Docker Compose

The existing local development workflow remains valid and documented:

- backend: local FastAPI
- frontend: local Vite

Docker becomes the official installation path for end users, not a replacement for the current developer workflow.

### Default Service Topology

The default Compose stack will contain exactly two services:

- `web`
- `api`

The optional `mcp` container remains in the repository but is moved out of the default stack. It should be exposed only through an opt-in Compose profile so the official install path matches the current product truth rather than future aspirations.

## Runtime Architecture

### `api` Service

The `api` container remains the single application runtime and owns:

- FastAPI API routes
- SQLite database access
- schema initialization and lightweight migrations at startup
- APScheduler-based daily refresh jobs
- PydanticAI orchestration
- transcription and document parsing integration

This is the correct deployment shape for the current code because the application already assumes a single process with local state and in-memory scheduler ownership.

### `web` Service

The `web` container becomes a production static-site and reverse-proxy container.

Responsibilities:

- serve the built SPA assets
- proxy `/api/*` requests to `http://api:8000`
- fall back unknown application routes to `index.html`

The current frontend Docker image must stop running `npm run dev`. A release-grade image should build once and serve static assets from a small production image.

### Optional `mcp` Service

The `mcp` service remains optional because:

- the current product scope is still application-first
- the existing `mcp-server/` implementation is placeholder-grade
- shipping it as a default dependency would misrepresent the current maturity of that path

## Networking and Browser Access

The browser should talk only to the `web` container in the official deployment path.

Implications:

- the frontend and backend become same-origin from the browser's perspective
- production no longer depends on cross-origin access to `api`
- the backend service does not need to be the public entry point

Recommended default:

- publish `web` on `${WEB_PORT}:80`
- keep `api` internal to the Compose network

This simplifies installation and avoids forcing users to understand multiple application ports for normal use.

## Persistence Model

### Required Persistent Data

The only required persistent application data for the first official Docker release is the SQLite database file.

Compose contract:

- mount `/data` into the `api` container
- set `KINCARE_DB_PATH=/data/kincare.db`

This matches the current backend configuration and schema initialization flow.

### Optional Persistent Data

A second optional mount may be provided for model and parser artifacts, for example `/models`, to support:

- `local_whisper` model downloads
- pre-downloaded Docling artifacts

This mount improves cold-start and offline behavior but is not part of the minimum data backup set.

### Explicit Non-Persistence

The official deployment path should not invent a persistent upload directory yet.

Reason:

- current attachment handling writes temporary files only for parsing
- parsed content is returned to the chat flow and the temporary files are deleted
- there is no stable "stored original attachment" product boundary in the current code

Adding an uploads volume now would create operational complexity without matching current product behavior.

## Backup Boundary

The documentation should define a narrow and honest backup story:

- mandatory backup target: `/data/kincare.db`
- optional backup target: model cache directory if local Whisper or offline Docling assets are used

The first Docker release should not introduce a dedicated backup sidecar or backup job. The product does not yet need that extra operational surface area.

## Environment Configuration

### Principle

`.env.example` should become an end-user oriented configuration template, not a dump of internal runtime wiring.

### Keep in `.env.example`

These are user-facing configuration knobs that should remain:

- `WEB_PORT`
- `KINCARE_JWT_SECRET`
- `KINCARE_SCHEDULER_TIMEZONE`
- `KINCARE_AI_BASE_URL`
- `KINCARE_AI_API_KEY`
- `KINCARE_AI_MODEL`
- `KINCARE_STT_PROVIDER`
- `KINCARE_STT_BASE_URL`
- `KINCARE_STT_API_KEY`
- `KINCARE_STT_MODEL`
- `KINCARE_STT_LANGUAGE`
- `KINCARE_STT_PROMPT`
- `KINCARE_STT_TIMEOUT_SECONDS`
- `KINCARE_LOCAL_WHISPER_MODEL`
- `KINCARE_LOCAL_WHISPER_DEVICE`
- `KINCARE_LOCAL_WHISPER_COMPUTE_TYPE`
- `KINCARE_LOCAL_WHISPER_DOWNLOAD_ROOT`
- `KINCARE_DOCLING_ARTIFACTS_PATH`

Refresh scheduling may remain configurable through environment defaults even though admin settings can later override them at runtime:

- `KINCARE_HEALTH_SUMMARY_REFRESH_HOUR`
- `KINCARE_HEALTH_SUMMARY_REFRESH_MINUTE`
- `KINCARE_CARE_PLAN_REFRESH_HOUR`
- `KINCARE_CARE_PLAN_REFRESH_MINUTE`

### Remove from `.env.example`

These values should not be part of the public installation surface:

- `KINCARE_DB_PATH`
- `VITE_API_BASE_URL`
- `API_PORT`
- stale `POSTGRES_*` variables

They are either internal implementation details or no longer aligned with the current SQLite-first deployment baseline.

## Health and Startup Contract

Compose must model service readiness explicitly.

### `api` Health Check

Use the existing `/health` route:

- probe `http://127.0.0.1:8000/health`

### `web` Health Check

Probe the root page:

- probe `http://127.0.0.1/`

### Startup Ordering

The `web` service should depend on `api` with a readiness condition rather than plain process ordering:

- `depends_on`
- `condition: service_healthy`

This upgrades the stack from "containers started" to "application available".

### Restart Behavior

Default services should use:

- `restart: unless-stopped`

That fits the expected behavior of a self-hosted home service better than one-shot developer defaults.

## Frontend Build and Runtime Contract

### Production Image

The frontend image should become a multi-stage build:

1. install dependencies with `npm ci`
2. run `npm run build`
3. copy the generated assets into a lightweight web server image

### Runtime Server Choice

Nginx is the recommended first choice because it is sufficient for:

- static asset serving
- SPA fallback
- `/api` reverse proxying

No additional application logic is needed in the frontend container.

### API Base URL Strategy

Production should use a same-origin API path:

- `VITE_API_BASE_URL=/api`

Local development should continue to override it with the existing host-based URL, such as `http://localhost:8000`.

This preserves the current developer workflow while making the Docker deployment simpler and more robust.

## Compose Structure

### Default Stack

The official `docker-compose.yml` should express:

- `web` as the public entry point
- `api` as the internal application service
- a named volume for database persistence
- an optional named volume for models/artifacts if needed

### Optional Profiles

`mcp` should move behind an opt-in profile, for example:

- `profiles: ["mcp"]`

This keeps the file extensible without making the placeholder service part of the supported default runtime.

## Constraints and Operational Warnings

### Single Instance Only

The stack should be documented as single-instance only.

Why:

- SQLite is file-backed
- the scheduler runs in-process
- multiple `api` replicas would risk duplicated scheduled jobs and conflicting write behavior

### CORS Role

CORS remains relevant for local development, not for the official production path.

The same-origin `web -> /api -> api` flow should be the documented default for Docker installs.

### Database Migrations

No separate migration container is required at this stage because the backend already performs schema initialization and compatibility migrations at startup.

## Documentation and Release Deliverables

### README Changes

The README must stop describing Docker as a future-facing skeleton.

It should instead:

- present Docker Compose as the official installation path
- keep local FastAPI + Vite as the developer workflow
- explain the single public web entry point
- document the backup target and optional model-cache persistence

### Release-Friendly Assets

For early releases, the essential installation artifacts are:

- `docker-compose.yml`
- `.env.example`

Users should be able to clone the repository or download release assets and start from the same minimal instructions.

### Support Level Definitions

The docs should explicitly classify support levels:

Officially supported now:

- `web + api`
- SQLite persistence
- built-in scheduler
- same-origin browser access via reverse proxy

Optional / experimental:

- `mcp` profile
- local Whisper
- offline Docling artifact provisioning

Not part of the first official Docker support promise:

- PostgreSQL as the default path
- multi-instance runtime
- development hot-reload Compose

## Implementation Impact

This design mainly affects:

- `docker-compose.yml`
- `frontend/Dockerfile`
- a new frontend web-server config file such as `frontend/nginx.conf`
- `.env.example`
- `README.md`
- possibly small frontend API base URL adjustments if production defaults need to become same-origin friendly

No new ADR is required for this work. It implements the already-accepted Docker-first direction from ADR-0004 while aligning it with the current SQLite-first and app-first baseline.

## Open Questions Resolved in This Design

### Should Docker support PostgreSQL immediately?

No. SQLite remains the default and official path.

### Should the default stack include MCP?

No. MCP remains optional until the service is more than a placeholder.

### Should the Docker path replace local development?

No. Docker is the official end-user install path; local FastAPI + Vite remains the recommended development workflow.

### Should we add persistent upload storage now?

No. The current attachment implementation is transient and should stay that way until the product introduces a real stored-attachments boundary.
