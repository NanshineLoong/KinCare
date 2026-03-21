# KinCare

**Self-hosted family health assistant for a single household**

KinCare is a locally deployed family health management system. This repository now follows the active development baseline in [`.cursor/plans/kincare_v2_开发计划_a24f52a8.plan.md`](./.cursor/plans/kincare_v2_开发计划_a24f52a8.plan.md). The docs intentionally describe the latest target architecture rather than preserving superseded plan history.

## Active Baseline (2026-03)

- Health data model: simplified health fact layer from [ADR-0009](./docs/adr/0009-simplified-health-fact-layer.md)
- Permission model: three-level member permissions with scoped grants from [ADR-0011](./docs/adr/0011-three-level-member-permissions.md)
- AI runtime: in-app PydanticAI with tool-calling conversations, structured actions, draft approval flow, and unified transcription entry from [ADR-0010](./docs/adr/0010-pydantic-ai-tool-calling.md)
- Official install path: single-machine Docker Compose with `web + api` as the default stack
- Development baseline: local FastAPI + Vite + SQLite remains the recommended workflow for feature work

## Delivery Status

- Steps `1 / 2A / 2B / 2C / 3A / 3B / 3C` of the v2 plan are complete: the current mainline already includes the three-level permission model, richer dashboard data structures, unified `HealthRecordAction` draft actions, real STT-backed transcription, upgraded daily generation output, and chat session history APIs
- Next implementation tracks are `Step 4 / 5 / 6 / 7` (Step 7 now encompasses `7A` permissions UI + settings sheet, `7B` session history, `7C` language settings, and `7D` model configuration)
- Existing automated tests from the previous baseline remain relevant, but upcoming product work will extend backend and frontend coverage

## Product Scope

- Family dashboard, member profile, and manual editing workflows
- Username-first authentication: `username` is the login identifier, `email` is optional contact info
- Simplified health archive around `Observation`, `SleepRecord`, `WorkoutRecord`, `Condition`, `Medication`, `Encounter`, `HealthSummary`, and `CarePlan`
- Member-level permissions with `read / write / manage` and `specific / all` scope
- AI conversation with controlled tools, structured suggestions/drafts, session history, and voice transcription
- Unified attachment intake for audio, images, PDF, DOCX, and local `.doc` fallback parsing in the chat composer
- Settings sheet with three tabs: **Preferences** (language zh/en, daily refresh times for admin, dark/light/system theme) and **AI Config** (admin-only voice transcription and chat model parameters, persisted to `system_config` table)
- Future MCP exposure after the in-app architecture stabilizes

## Install with Docker Compose

```bash
cp .env.example .env
# Edit .env and set at least KINCARE_JWT_SECRET plus any AI / STT credentials you need

docker compose up -d
```

Default Docker URL:

- Web app: `http://localhost:8080`

Operational notes:

- The browser talks only to `web`; Nginx proxies `/api` to the internal `api` service.
- SQLite remains the only required persistent state and is stored in the `kincare-data` volume at `/data/kincare.db` inside the `api` container.
- `mcp` is optional and not part of the default stack. Start it only when needed with `docker compose --profile mcp up -d`.
- Local Whisper now defaults to the Hugging Face cache inside the `api` container and is persisted via the `kincare-hf-cache` volume mounted at `/root/.cache/huggingface`.
- If you want explicit container-internal model directories such as `/models/docling`, the optional `kincare-models` volume remains available at `/models`.

Backup and upgrade:

- Backup the SQLite database before upgrades. The required backup target is `/data/kincare.db` inside the `kincare-data` volume.
- Upgrade local source installs with `docker compose build --pull && docker compose up -d`.
- The username-first auth switch is not backward-compatible with older SQLite files that only contain `user_account.email`. Recreate the database before restart by removing `/data/kincare.db` from the `kincare-data` volume.

## Local Development

```bash
# Create local config once
cp .env.example .env
# Edit .env and fill AI / STT credentials as needed

# Backend
cd backend
UV_CACHE_DIR=/tmp/kincare-uv-cache uv venv .venv
UV_CACHE_DIR=/tmp/kincare-uv-cache uv pip install --python .venv/bin/python -r requirements.txt
.venv/bin/uvicorn app.main:app --reload

# Frontend (another terminal)
cd frontend
npm ci
VITE_API_BASE_URL=http://localhost:8000 npm run dev -- --host 0.0.0.0 --port 5173
```

Default local development URLs:

- Frontend: `http://localhost:5173`
- Backend health check: `http://localhost:8000/health`

Database reset note:

- The username-first auth switch is not backward-compatible with the previous SQLite schema. If startup reports a legacy `user_account` schema, delete `backend/data/kincare.db` and restart so the schema is recreated.

Optional AI runtime configuration:

- `KINCARE_AI_BASE_URL`
- `KINCARE_AI_API_KEY`
- `KINCARE_AI_MODEL`
- `KINCARE_STT_PROVIDER` (`openai` or `local_whisper`)
- `KINCARE_STT_BASE_URL` / `KINCARE_STT_API_KEY` (optional; defaults to the AI values when omitted)
- `KINCARE_STT_MODEL`
- `KINCARE_STT_LANGUAGE`
- `KINCARE_STT_PROMPT`
- `KINCARE_STT_TIMEOUT_SECONDS`
- `KINCARE_LOCAL_WHISPER_MODEL`
- `KINCARE_LOCAL_WHISPER_DEVICE`
- `KINCARE_LOCAL_WHISPER_COMPUTE_TYPE`
- `KINCARE_LOCAL_WHISPER_DOWNLOAD_ROOT`
- `KINCARE_DOCLING_ARTIFACTS_PATH` (optional; points Docling to a pre-downloaded local model directory for offline parsing)
- `KINCARE_HEALTH_SUMMARY_REFRESH_HOUR`
- `KINCARE_HEALTH_SUMMARY_REFRESH_MINUTE`
- `KINCARE_CARE_PLAN_REFRESH_HOUR`
- `KINCARE_CARE_PLAN_REFRESH_MINUTE`

The backend automatically loads the project root `.env`, so local AI credentials can be stored there instead of being prefixed on the startup command.

Attachment parsing notes:

- Install `docling[rapidocr]` with backend dependencies to enable PDF / image / DOCX parsing.
- The new chat attachment endpoint keeps audio uploads on the existing STT flow and parses documents separately.
- Legacy `.doc` files use the local macOS `textutil` fallback when available; converting them to `.docx` or PDF remains the safer path for cross-platform deployments.
- For offline or weak-network deployments, prefetch Docling models with `docling-tools models download` and point `KINCARE_DOCLING_ARTIFACTS_PATH` to that container-internal directory, such as `/models/docling`, when using Docker.

## Testing

```bash
# Backend
cd backend && UV_CACHE_DIR=/tmp/kincare-uv-cache uv run --no-project --with-requirements requirements-dev.txt pytest

# Frontend
cd frontend && npm test
```

The repository does not currently include E2E tests. For doc-only work, consistency checks are sufficient; feature steps should still run the relevant backend and frontend test suites.

## Project Structure

```text
KinCare/
├── AGENTS.md
├── README.md
├── .cursor/plans/
│   └── kincare_v2_开发计划_a24f52a8.plan.md
├── docs/
│   ├── adr/
│   ├── architecture/
│   ├── prd/
│   └── proposals/        # Accepted proposal snapshots kept only for ADR backlinks
├── stitch-screens/       # Old design reference, read-only, no longer the active UI baseline
├── backend/
├── frontend/
├── mcp-server/           # Optional future-facing service, not part of the default install path
└── docker-compose.yml    # Official single-machine installation entry point
```

## Source-of-Truth Documents

| Document | Purpose |
|---|---|
| [Active Plan](./.cursor/plans/kincare_v2_开发计划_a24f52a8.plan.md) | Current development order and status |
| [Architecture Overview](./docs/architecture/overview.md) | System boundaries and runtime shape |
| [Data Model](./docs/architecture/data-model.md) | Active health data schema baseline |
| [Phase 4 AI Design](./docs/architecture/phase-4-ai-design.md) | Active AI orchestration design |
| [MVP PRD](./docs/prd/mvp-v1.md) | Product scope aligned to the current baseline |
| [ADR Index](./docs/adr/README.md) | Accepted architecture decisions and supersede notes |

## License

TBD
