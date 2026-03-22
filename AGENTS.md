# AGENTS.md - KinCare Agent Working Constraints

This file defines the behavior rules for AI coding agents in this project. All automated coding, review, and commit operations must follow the constraints below.

---

## Project Context

KinCare currently uses the architecture documents and ADRs in this repository as its primary sources of truth. Before modifying code, read the following documents first and confirm whether they are directly relevant to the task at hand:

- Architecture overview: `docs/architecture/overview.md`
- Data model: `docs/architecture/data-model.md`
- AI architecture: `docs/architecture/ai-design.md`
- Architecture decisions: `docs/adr/README.md`

If old implementations or old documents conflict with the current direction, use this priority order:

1. The user's direct instructions for the current task
2. ADR-0011 / ADR-0009 / ADR-0010
3. Current architecture documents
4. Old code and old design traces

---

## Build And Run

```bash
# Current recommended local development workflow
# First copy the root .env.example to .env and fill in AI configuration and other environment variables

# Backend
cd backend
UV_CACHE_DIR=/tmp/kincare-uv-cache uv venv .venv
UV_CACHE_DIR=/tmp/kincare-uv-cache uv pip install --python .venv/bin/python -r requirements.txt
.venv/bin/uvicorn app.main:app --reload

# Frontend (in another terminal)
cd frontend
npm ci
VITE_API_BASE_URL=http://localhost:8000 npm run dev -- --host 0.0.0.0 --port 5173
```

```bash
# Official end-user installation path
docker compose up --build
docker compose logs -f
```

> The current development baseline continues to use local SQLite (`KINCARE_DB_PATH`) with FastAPI and Vite started separately on the host machine. The official end-user installation path is single-machine Docker Compose. `mcp-server/` remains an optional future capability exposure layer and is not part of the default installation stack.

## Testing

```bash
# Backend tests
cd backend && UV_CACHE_DIR=/tmp/kincare-uv-cache uv run --no-project --with-requirements requirements-dev.txt pytest

# Frontend tests
cd frontend && npm test
```

> This repository does not currently provide E2E tests. Any PR that changes implementation must run at least the relevant backend and frontend tests. If test coverage is still missing, state that explicitly in the result summary.

---

## Code Style

- Use the formatting and lint configuration defined at the project root
- Run the relevant lint / format / test commands before committing
- Use English for function, class, and field names
- Comments should explain only non-obvious intent, constraints, or tradeoffs

## AI Implementation Constraints

- Before changing AI chat, extraction, transcription, or scheduling, read `docs/architecture/ai-design.md`
- When AI reads or modifies health data, it must reuse the existing business service layer and member-level permission checks; do not let AI access the database directly
- Member-level permissions are defined by `read / write / manage` plus `specific / all`; do not continue using the old `can_write` boolean semantics
- Do not inject full or unauthorized health data directly into prompts; prefer minimal context plus controlled tool calls
- Prefer to preserve the responsibility boundaries under `backend/app/ai/`: `deps.py`, `agent.py`, `daily_generation.py`, `orchestrator.py`, `tools/`, `transcription.py`, `extraction.py`, and `scheduler.py`
- Attachment parsing should continue to use the `backend/app/attachments/` boundary; audio must continue through `transcription.py`; do not push PDF / image / document parsing back into the audio transcription path
- Do not reintroduce the old keyword-routed orchestrator, the `providers/` main abstraction, or the `DocumentReference` standalone document-resource path as the current solution
- High-risk health-record writes must continue to follow "generate draft -> user confirmation -> service-layer write"
- Suggestions and draft write-back should reuse the unified `HealthRecordAction` structure; do not split `create / update / delete` into separate protocols again
- For external systems such as PydanticAI, model services, ASR, document parsing, and MCP, rely on their official documentation and the current version behavior; repository documents define boundaries and the current default direction only

---

## Directory Rules

```text
KinCare/
├── .cursor/plans/             # Internal planning files (if present)
├── docs/                      # Active documentation and ADRs
│   ├── prd/
│   ├── architecture/
│   └── adr/
├── stitch-screens/            # Old UI references (read-only, no longer the current design baseline)
├── backend/
├── frontend/
├── mcp-server/                # Optional future capability exposure layer
└── docker-compose.yml         # Official single-machine installation entrypoint
```

- `stitch-screens/` must **not** be modified
- Accepted ADRs under `docs/adr/` must **not** have their content edited; only supersede them through a new ADR
- New ADRs must use incrementing numbers: `docs/adr/NNNN-<kebab-case-title>.md`

---

## Prohibited Actions

1. Do **not** hardcode secrets, passwords, or personal health data in code
2. Do **not** modify files under `stitch-screens/`
3. Do **not** submit functional code without corresponding verification
4. Do **not** introduce dependencies that are not declared in dependency management files
5. Do **not** mix unrelated changes in the same PR
6. Do **not** edit the content of Accepted ADRs
7. Do **not** store non-anonymized real health data in code as test data
8. Do **not** bypass the service layer and permission model to operate on health data directly
9. Do **not** write superseded old designs back into the README, architecture documents, or implementation

---

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Allowed `type` values:**

| type | Purpose |
|------|------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation change |
| `refactor` | Refactor without functional change |
| `test` | Test-related change |
| `chore` | Build / tooling / dependency change |

**Example scopes:** `auth`, `member`, `health-record`, `ai`, `ui`, `docs`

---

## PR Process

1. Create a feature branch from the main branch: `feat/<scope>-<description>` or `fix/<scope>-<description>`
2. Implement a single focused change
3. Run verification commands relevant to the change
4. Commit using the Conventional Commits format
5. Create a PR with a change summary, related plan/ADR references, test plan, and risk notes

---

## Data Safety Reminder

KinCare handles sensitive personal health information. During development:

- Test data must be fictional
- Logs must not output raw health data
- API responses must not leak data beyond the permission model
- Health data is controlled by member-level permissions by default; the family member directory should return only the basic information allowed to be exposed at the current stage
