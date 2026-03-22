# KinCare Architecture Overview

> This document defines the current target architecture of KinCare. If old implementations, old documents, or old terminology conflict with this document, use [ADR-0009](../adr/0009-simplified-health-fact-layer.md), [ADR-0010](../adr/0010-pydantic-ai-tool-calling.md), and [ADR-0011](../adr/0011-three-level-member-permissions.md) as the source of truth.

## Current Mainline

- One instance = one family space
- The frontend is a React + Vite SPA, and the backend is FastAPI
- Authentication is username-first: `username` is the login identifier, and `email` is an optional contact field
- AI runs inside the application and is based on PydanticAI
- Health data uses a simplified health fact layer
- Member authorization uses three permission levels, `read / write / manage`, and supports `specific / all` scope
- The home family dashboard, member overview, unified input area, and session history share the same data semantics
- The current development runtime continues to use SQLite; the official end-user installation path is single-machine Docker Compose, while the development workflow still centers on local FastAPI + Vite

## Design Principles

1. **Privacy first:** default to local deployment, local storage, and minimized external dependencies
2. **Single source of truth:** health data, AI summaries, reminders, permissions, and session history all return to a unified service layer and data model
3. **Capability-based permissions:** member access capabilities use `manage > write > read` as the source of truth; the frontend only presents them, and the backend makes the final decision
4. **Minimal context:** prompts inject only identity, session, page focus, and authorization scope, while detailed data is read on demand through tools
5. **Unified conversation entrypoint:** text, voice, and attachment context all enter the same chat and approval flow without branching the data path
6. **Session continuity:** session titles, summaries, and message history are first-class capabilities that support restoring user context
7. **Current app first:** prioritize making the in-app experience work well first; MCP is a later external exposure layer, not the current main path for web chat

## System Context

| Participant | Description |
|---|---|
| Family members | Use the family dashboard, member profiles, permission UI, and AI chat through a browser |
| External LLM / STT services | Provide PydanticAI inference and real speech transcription |
| External AI / MCP clients | Can connect to KinCare through MCP in later phases |

## Container View

```text
┌────────────────────────────────────────────────────────────┐
│                         KinCare                          │
│                                                            │
│  ┌──────────────┐      ┌──────────────────────────────┐    │
│  │   Web App    │─────▶│           API Server         │    │
│  │  React SPA   │      │ REST API / SSE / Scheduler   │    │
│  │              │      │ Health Services / AI Runtime │    │
│  └──────────────┘      └──────────────┬───────────────┘    │
│                                       │                    │
│                                 ┌─────▼─────┐              │
│                                 │ Database  │              │
│                                 │ SQLite    │              │
│                                 └───────────┘              │
└───────────────────────────────────────┬────────────────────┘
                                        │
                    ┌───────────────────▼───────────────────┐
                    │ External Model Services                │
                    │ OpenAI-compatible LLM / STT provider   │
                    └────────────────────────────────────────┘

Optional future edge:
Web/App/API/MCP Client ──▶ MCP Server ──▶ API Server
```

## Container Responsibilities

### Web App

- Branded home family dashboard and member overview entrypoint
- Member profiles, manual editing, and authorization management panels
- Unified input area, voice capture, SSE message stream, and draft-confirmation interaction
- Session history list and session restoration
- Settings sheet tabs for **Preferences**, covering language switching `zh/en`, daily refresh times, and light/dark/system appearance, all persisted in `localStorage`, with time configuration restricted to admins; and **AI Config**, for administrators, covering speech transcription and chat model runtime parameters
- In Docker deployment, a front static web container serves SPA assets and reverse-proxies same-origin `/api` requests to the API server

### API Server

- Authentication, member-level permissions, and health-data CRUD
- User authentication uses `username` as the unique login identifier; `email` participates only as an optional contact field for deduplication
- Dashboard aggregation, member-detail queries, and session-history queries
- AI session entrypoint, attachment parsing APIs, SSE streaming output, draft confirmation, and audio transcription APIs
- Scheduled task triggering and health summary / reminder write-back
- Admin system configuration API, `GET/PUT /api/admin/settings`, which reads and writes the `system_config` table, and allows AI / STT runtime parameters plus daily refresh times to override `.env` defaults

### AI Runtime (internal API server modules)

- `agent.py`: PydanticAI agent factory and system-prompt assembly
- `daily_generation.py`: offline structured daily generation
- `deps.py`: runtime dependency injection
- `tools/`: read tools, low-risk write tools, approval-based write tools, and suggestion tools
- `orchestrator.py`: `agent.iter()` loops and SSE event mapping
- `transcription.py`: real STT provider adaptation and transcription entrypoint
- `extraction.py`: structured draft generation from chat or attachment context
- `scheduler.py`: daily summary and reminder jobs

### Attachments

- `backend/app/attachments/`: a separate attachment parsing boundary responsible for document and image parsing, local fallback for `.doc`, and handing controlled excerpts into the chat flow
- Audio attachments continue through `transcription.py` and do not share the same implementation as PDF, image, or document parsing

### Database

- The current development baseline is a local SQLite file
- It stores users, members, health facts, permission grants, chat sessions, session summaries, and scheduling definitions
- The target deployment ADR still keeps PostgreSQL as a direction, but it is not the default runtime assumption in current development documents

### MCP Server (later phase)

- Reuses API and service-layer capabilities for external use later
- Is not part of the current web chat path
- Remains under an optional Compose profile and should be pushed further only after the in-app capabilities stabilize

## Core Data Flows

### 1. Family dashboard and member profiles

```text
Web App
  → API Server
  → Health services / repository
  → Database
  → Return member info, permission summaries, HealthSummary, CarePlan, and health resource data
```

### 2. AI chat, suggestions, and draft confirmation

```text
User message / voice / attachment context
  → Web App
  → Attachments first pass through the separate parsing API, except audio which still goes through STT
  → API Server authentication and session loading
  → AI Runtime assembles minimal context and authorization scope
  → PydanticAI agent.iter()
      → Calls read / write / approval / suggestion tools on demand
  → SSE returns message and tool events
  → User confirms high-risk drafts
  → API Server reuses the service layer to write to the database
```

### 3. Session history and restoration

```text
Web App opens history
  → API Server queries the ChatSession list
  → Returns title / summary / updated_at
  → User selects a session
  → API Server returns message history
  → Frontend restores the current session context
```

### 4. Daily AI generation jobs

```text
Scheduler triggers
  → Service layer reads minimal member health snapshots
  → AI Runtime generates flexible HealthSummary and multiple CarePlan items
  → Writes back to the database
  → Home page and member profiles read the latest results
```

### 5. Future MCP calls

```text
External MCP client
  → MCP Server
  → API Server / service layer
  → Database
```

## Old Paths Explicitly No Longer Used

- `DocumentReference` and a standalone document upload flow are no longer treated as the main path of the health fact layer
- The keyword-routed custom orchestrator is no longer treated as the default AI orchestration model
- A standalone `File Storage` container is no longer part of the current main architecture
- The `providers/` abstraction is no longer the center of the current AI design

## Document Scope

- This document describes the current target architecture, not compatibility guidance for historical implementations
- See [`data-model.md`](./data-model.md) for specific health-data boundaries
- See [`ai-design.md`](./ai-design.md) for specific AI runtime boundaries
