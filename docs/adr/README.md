# Architecture Decision Records (ADR)

This directory records the architecture decisions for the KinCare project and uses the [MADR](https://adr.github.io/madr/) format.

## Rules

- New ADRs must use incrementing numbers: `NNNN-<kebab-case-title>.md`
- Accepted ADRs must **not** have their content edited; they may only be superseded by a new ADR
- Each ADR should focus on one decision

## Index

| ADR | Title | Status | Date | Current role |
|---|---|---|---|---|
| [0001](./0001-fhir-style-data-model.md) | Adopt a FHIR-style data model | Accepted | 2026-03-11 | The overall resource-oriented direction remains; MVP-level fields and resource sets were partially superseded by ADR-0009 |
| [0002](./0002-single-instance-family-space.md) | One instance = one family space | Accepted | 2026-03-11 | Still valid |
| [0003](./0003-mcp-server-for-health-data.md) | Expose health-data capabilities through an MCP server | Accepted | 2026-03-11 | Still a later-phase direction, not the current implementation mainline |
| [0004](./0004-docker-first-deployment.md) | Docker Compose first deployment strategy | Accepted | 2026-03-11 | Retained as the target deployment direction; current development runtime is still local FastAPI + Vite + SQLite |
| [0005](./0005-frontend-stack-react-vite-tailwind.md) | Use React + Vite + TypeScript + Tailwind CSS for the frontend | Accepted | 2026-03-11 | Still valid |
| [0006](./0006-backend-stack-fastapi.md) | Use Python + FastAPI for the backend | Accepted | 2026-03-11 | Still valid |
| [0007](./0007-postgresql-as-primary-database.md) | Use PostgreSQL as the primary database | Accepted | 2026-03-11 | Retained as a target deployment decision; the current development baseline still uses SQLite |
| [0008](./0008-jwt-access-refresh-auth.md) | Use JWT access tokens and refresh tokens for authentication | Accepted | 2026-03-11 | Still valid |
| [0009](./0009-simplified-health-fact-layer.md) | Adopt a simplified health fact layer for MVP v1 | Accepted | 2026-03-15 | Current health-data model baseline |
| [0010](./0010-pydantic-ai-tool-calling.md) | Use a PydanticAI tool-calling loop for in-app AI orchestration | Accepted | 2026-03-15 | Current AI architecture baseline |
| [0011](./0011-three-level-member-permissions.md) | Adopt three-level member permissions with scoped grants | Accepted | 2026-03-16 | Current member authorization model baseline |
