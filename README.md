# HomeVital

**Self-hosted family health assistant for a single household**

HomeVital is a locally deployed family health management system. This repository now follows the active development baseline in `.cursor/plans/homevital_新开发计划_a2e4e028.plan.md`; superseded Phase 0-5 planning is no longer the primary source of truth.

## Active Baseline (2026-03)

- Health data model: simplified health fact layer from [ADR-0009](./docs/adr/0009-simplified-health-fact-layer.md)
- AI runtime: in-app PydanticAI tool-calling and draft approval flow from [ADR-0010](./docs/adr/0010-pydantic-ai-tool-calling.md)
- UI direction: Step 6 follows the 16-screen redesign referenced by the active plan, not the early `stitch-screens/` set
- Runtime baseline: local FastAPI + Vite + SQLite for current development; `docker-compose.yml` and `mcp-server/` remain future-facing skeletons

## Delivery Status

- Completed baseline in the active plan: ADR finalization, PydanticAI API validation, health schema migration, AI orchestration migration, frontend page rebuild, AI daily generation, and test refresh/integration verification
- Documentation reset: Step 9 was executed early and is now aligned with the implemented Step 6-8 baseline
- Next product work should build on this baseline instead of restoring the superseded pre-ADR architecture

## Product Scope

- Family member management with member-level permissions
- Simplified health archive around `Observation`, `SleepRecord`, `WorkoutRecord`, `Condition`, `Medication`, `Encounter`, `HealthSummary`, and `CarePlan`
- AI conversation with controlled read/write tools, SSE streaming, and confirm-before-write drafts
- Dashboard and member profile workflows driven by summaries, reminders, and structured health data
- Future MCP exposure after the in-app architecture stabilizes

## Quick Start

```bash
# Create local config once
cp .env.example .env
# Edit .env and fill HOMEVITAL_AI_BASE_URL / HOMEVITAL_AI_API_KEY as needed

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
- `HOMEVITAL_HEALTH_SUMMARY_REFRESH_HOUR`
- `HOMEVITAL_HEALTH_SUMMARY_REFRESH_MINUTE`
- `HOMEVITAL_CARE_PLAN_REFRESH_HOUR`
- `HOMEVITAL_CARE_PLAN_REFRESH_MINUTE`

The backend now automatically loads the project root `.env`, so local AI credentials can be stored there instead of being prefixed on the startup command.

## Testing

```bash
# Backend
cd backend && UV_CACHE_DIR=/tmp/homevital-uv-cache uv run --no-project --with-requirements requirements-dev.txt pytest

# Frontend
cd frontend && npm test
```

The repository does not currently include E2E tests. The active baseline closes Step 8 with refreshed backend/frontend automated tests, but still relies on manual UI acceptance for full end-to-end coverage.

## Project Structure

```text
HomeVital/
├── AGENTS.md
├── README.md
├── .cursor/plans/
│   └── homevital_新开发计划_a2e4e028.plan.md
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
| [Active Plan](./.cursor/plans/homevital_新开发计划_a2e4e028.plan.md) | Current development order and status |
| [Architecture Overview](./docs/architecture/overview.md) | System boundaries and runtime shape |
| [Data Model](./docs/architecture/data-model.md) | Active health data schema baseline |
| [Phase 4 AI Design](./docs/architecture/phase-4-ai-design.md) | Active AI orchestration design |
| [MVP PRD](./docs/prd/mvp-v1.md) | Product scope aligned to the current baseline |
| [ADR Index](./docs/adr/README.md) | Accepted architecture decisions and supersede notes |

## License

TBD
