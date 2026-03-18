# HomeVital

**Self-hosted family health assistant for a single household**

HomeVital is a locally deployed family health management system. This repository now follows the active development baseline in [`.cursor/plans/homevital_v2_开发计划_a24f52a8.plan.md`](./.cursor/plans/homevital_v2_开发计划_a24f52a8.plan.md). The docs intentionally describe the latest target architecture rather than preserving superseded plan history.

## Active Baseline (2026-03)

- Health data model: simplified health fact layer from [ADR-0009](./docs/adr/0009-simplified-health-fact-layer.md)
- Permission model: three-level member permissions with scoped grants from [ADR-0011](./docs/adr/0011-three-level-member-permissions.md)
- AI runtime: in-app PydanticAI with tool-calling conversations, structured actions, draft approval flow, and unified transcription entry from [ADR-0010](./docs/adr/0010-pydantic-ai-tool-calling.md)
- Runtime baseline: local FastAPI + Vite + SQLite for current development; `docker-compose.yml` and `mcp-server/` remain future-facing skeletons

## Delivery Status

- Steps `1 / 2A / 2B / 2C / 3A / 3B / 3C` of the v2 plan are complete: the current mainline already includes the three-level permission model, richer dashboard data structures, unified `HealthRecordAction` draft actions, real STT-backed transcription, upgraded daily generation output, and chat session history APIs
- Next implementation tracks are `Step 4 / 5 / 6 / 7` (Step 7 now encompasses `7A` permissions UI + settings sheet, `7B` session history, `7C` language settings, and `7D` model configuration)
- Existing automated tests from the previous baseline remain relevant, but upcoming product work will extend backend and frontend coverage

## Product Scope

- Family dashboard, member profile, and manual editing workflows
- Simplified health archive around `Observation`, `SleepRecord`, `WorkoutRecord`, `Condition`, `Medication`, `Encounter`, `HealthSummary`, and `CarePlan`
- Member-level permissions with `read / write / manage` and `specific / all` scope
- AI conversation with controlled tools, structured suggestions/drafts, session history, and voice transcription
- Settings sheet with three tabs: **Preferences** (language zh/en, daily refresh times for admin, dark/light/system theme) and **AI Config** (admin-only voice transcription and chat model parameters, persisted to `system_config` table)
- Future MCP exposure after the in-app architecture stabilizes

## Quick Start

```bash
# Create local config once
cp .env.example .env
# Edit .env and fill AI / STT credentials as needed

# Backend
cd backend
UV_CACHE_DIR=/tmp/homevital-uv-cache uv venv .venv
UV_CACHE_DIR=/tmp/homevital-uv-cache uv pip install --python .venv/bin/python -r requirements.txt
.venv/bin/uvicorn app.main:app --reload

# Frontend (another terminal)
cd frontend
npm ci
VITE_API_BASE_URL=http://localhost:8000 npm run dev -- --host 0.0.0.0 --port 5173
```

Default local URLs:

- Frontend: `http://localhost:5173`
- Backend health check: `http://localhost:8000/health`

Optional AI runtime configuration:

- `HOMEVITAL_AI_BASE_URL`
- `HOMEVITAL_AI_API_KEY`
- `HOMEVITAL_AI_MODEL`
- `HOMEVITAL_STT_PROVIDER` (`openai` or `local_whisper`)
- `HOMEVITAL_STT_BASE_URL` / `HOMEVITAL_STT_API_KEY` (optional; defaults to the AI values when omitted)
- `HOMEVITAL_STT_MODEL`
- `HOMEVITAL_STT_LANGUAGE`
- `HOMEVITAL_STT_PROMPT`
- `HOMEVITAL_STT_TIMEOUT_SECONDS`
- `HOMEVITAL_LOCAL_WHISPER_MODEL`
- `HOMEVITAL_LOCAL_WHISPER_DEVICE`
- `HOMEVITAL_LOCAL_WHISPER_COMPUTE_TYPE`
- `HOMEVITAL_LOCAL_WHISPER_DOWNLOAD_ROOT`
- `HOMEVITAL_HEALTH_SUMMARY_REFRESH_HOUR`
- `HOMEVITAL_HEALTH_SUMMARY_REFRESH_MINUTE`
- `HOMEVITAL_CARE_PLAN_REFRESH_HOUR`
- `HOMEVITAL_CARE_PLAN_REFRESH_MINUTE`

The backend automatically loads the project root `.env`, so local AI credentials can be stored there instead of being prefixed on the startup command.

## Testing

```bash
# Backend
cd backend && UV_CACHE_DIR=/tmp/homevital-uv-cache uv run --no-project --with-requirements requirements-dev.txt pytest

# Frontend
cd frontend && npm test
```

The repository does not currently include E2E tests. For doc-only work, consistency checks are sufficient; feature steps should still run the relevant backend and frontend test suites.

## Project Structure

```text
HomeVital/
├── AGENTS.md
├── README.md
├── .cursor/plans/
│   └── homevital_v2_开发计划_a24f52a8.plan.md
├── docs/
│   ├── adr/
│   ├── architecture/
│   ├── prd/
│   └── proposals/        # Accepted proposal snapshots kept only for ADR backlinks
├── stitch-screens/       # Old design reference, read-only, no longer the active UI baseline
├── backend/
├── frontend/
├── mcp-server/           # Future-facing skeleton
└── docker-compose.yml    # Future-facing deployment skeleton
```

## Source-of-Truth Documents

| Document | Purpose |
|---|---|
| [Active Plan](./.cursor/plans/homevital_v2_开发计划_a24f52a8.plan.md) | Current development order and status |
| [Architecture Overview](./docs/architecture/overview.md) | System boundaries and runtime shape |
| [Data Model](./docs/architecture/data-model.md) | Active health data schema baseline |
| [Phase 4 AI Design](./docs/architecture/phase-4-ai-design.md) | Active AI orchestration design |
| [MVP PRD](./docs/prd/mvp-v1.md) | Product scope aligned to the current baseline |
| [ADR Index](./docs/adr/README.md) | Accepted architecture decisions and supersede notes |

## License

TBD
