# KinCare AI Technical Design

> This document defines KinCare's current AI architecture. The old rule-driven orchestrator, standalone provider main abstraction, and document-upload mainline are no longer the current default route. The current baseline follows [ADR-0010](../adr/0010-pydantic-ai-tool-calling.md) and [ADR-0011](../adr/0011-three-level-member-permissions.md).

## Goals

- Provide streaming AI chat inside the application
- Support text, voice, and attachment context through one unified conversation entrypoint
- Generate structured health-record drafts and suggestions from conversation content
- Keep "draft first, confirm later" for high-risk writes
- Generate flexible `HealthSummary` outputs and multiple richer `CarePlan` items
- Provide automatic title and summary generation for session history

## Non-Goals

- Do not make MCP the first hop of the current web chat flow
- Do not restore `DocumentReference` standalone document resources or the old upload-processing chain
- Do not allow AI to access database tables directly
- Do not reintroduce the old keyword-matching-driven orchestrator

## Core Decisions

### 1. Use PydanticAI tool-calling for chat orchestration

Conversation orchestration is driven by PydanticAI and uses `agent.iter()` to run a multi-round tool-calling loop. A single request can go through multiple steps such as "read data -> reason -> produce a suggestion or draft -> continue generating text." Daily summaries and reminders reuse the same runtime, but produce structured output rather than chat output.

### 2. Route all data access through the service layer and three-level permission checks

AI tools may call only existing business services or repository boundaries. Member-level permission checks remain the responsibility of the backend service layer:

- Reading member data requires at least `read`
- Modifying health records requires at least `write`
- Viewing, granting, or revoking authorization requires at least `manage`

AI must not bypass these boundaries.

### 3. Inject only the minimal necessary context into prompts

The system prompt should provide only the following:

- Current user identity and role
- Current session ID, page context, and focus member
- Authorized member scope
- Current task description

Detailed health data should always be read on demand through tools.

### 4. Unify suggestions and write-back as `HealthRecordAction`

Suggestion cards and draft confirmation use the same shape:

```text
HealthRecordAction
  - action: create | update | delete
  - resource: target record resource type
  - target_member_id: target member
  - record_id: required for update/delete
  - payload: structured fields for create/update
```

Constraints:

- Suggestions must carry `target_member_id`
- Suggestions may point only to existing record sections
- High-risk record writes must go through draft confirmation; AI is not allowed to write directly to the database

### 5. Categorize tools by risk level

| Category | Description | Typical tools |
|---|---|---|
| Read tools | No side effects and callable at any time | `get_member_summary`, `get_recent_observations`, `get_conditions`, `get_medications`, `get_sleep_records`, `get_workout_records`, `get_encounters`, `get_care_plans` |
| Low-risk writes | Can execute directly | `create_care_plan`, `create_scheduled_task`, `mark_care_plan_done` |
| High-risk writes | Require approval | `draft_observations`, `draft_conditions`, `draft_medications`, `draft_encounter` |
| Proactive suggestions | Provide suggestions only and do not write directly | `suggest_record_update` |

### 6. Keep voice input on the same data path

The voice input chain is:

```text
Web Audio API capture
  → Upload audio to the backend
  → `transcription.py` calls the real STT provider
  → Return text
  → Fill the unified input box
  → Continue through the same chat / SSE / draft-confirmation flow
```

The STT provider is an implementation detail and must be hidden behind `backend/app/ai/transcription.py`.

### 7. Session titles and summaries are application capabilities

`ChatSession` needs to persist `title` and `summary`. The summary is automatically generated after the first valid user turn, currently with simple rules first. This can later be replaced by model-generated output without changing the API and storage boundaries.

### 8. Parse attachments before the chat flow and keep a separate boundary

Attachment handling uses a dedicated parsing entrypoint rather than reusing the audio transcription implementation:

- Audio files continue through the STT path in `transcription.py`
- PDF, images, and DOCX are parsed first inside `backend/app/attachments/`
- `.doc` may use local fallback adaptation, but still belongs to the attachment parsing boundary rather than returning to the STT path
- Only controlled excerpts may enter prompts or `AIDeps`, not full raw originals

## Runtime Module Boundaries

Current AI code should be organized around the following responsibilities:

- `backend/app/ai/deps.py`: `AIDeps` and runtime dependency injection
- `backend/app/ai/agent.py`: agent factory, system prompt, and tool registration
- `backend/app/ai/daily_generation.py`: structured daily-generation agent
- `backend/app/ai/tools/`: read tools, low-risk write tools, approval-based write tools, and suggestion tools
- `backend/app/ai/orchestrator.py`: `agent.iter()` loop, SSE event mapping, and approval recovery
- `backend/app/ai/transcription.py`: real STT provider adaptation
- `backend/app/ai/extraction.py`: structured draft generation from chat and attachment context
- `backend/app/ai/scheduler.py`: daily summary and reminder generation jobs
- `backend/app/attachments/`: attachment parsing, Docling adaptation, `.doc` fallback parsing, and attachment excerpt generation

## Conversation Flow

```text
User input (text / voice / attachment context)
  → Attachments first go through the dedicated parsing entrypoint, while audio still goes through STT
  → FastAPI route authentication
  → Assemble AIDeps and minimal context
  → PydanticAI agent.iter()
      → Read tools / low-risk writes / approval-based writes / suggestions
  → Custom SSE event output
  → Frontend displays messages, tool results, suggestion cards, and draft cards
  → User confirms high-risk drafts
  → Service layer performs the final write
```

## SSE Protocol Constraints

The current app keeps a custom SSE protocol instead of adopting an official AI UI protocol layer directly. Frontend and backend must stay aligned around the following events:

- `message.delta`
- `message.completed`
- `tool.started`
- `tool.result`
- `tool.draft`
- `tool.suggest`
- `tool.error`

The primary high-risk draft confirmation endpoint is `POST /api/chat/{session_id}/confirm-draft`.

## Daily Generation Constraints

Daily jobs must include at least two output types:

- `refresh_health_summaries`
- `refresh_daily_care_plans`

Generation constraints:

- `HealthSummary` count is not fixed, and `category` may be defined by AI
- `HealthSummary.status` is limited to `good / warning / alert`
- `CarePlan` supports multiple outputs and includes `time_slot`, `icon_key`, `assignee_member_id`, and `notes`
- The home page reads aggregated family-wide CarePlan items, while member overview reads only items related to that member
- If AI output is invalid or one member's generation fails, keep existing data rather than falling back to old templates

## PydanticAI API Constraints

The current implementation and future changes should follow these conclusions:

- Use the official documentation for the current stable version of PydanticAI as the source of truth, and re-check it before upgrades
- As long as any tool uses `requires_approval=True`, the agent `output_type` must include `DeferredToolRequests`
- `RunContext[AIDeps]` is the standard way for tools and prompts to read runtime context
- `agent.override(...)` should be used as a context manager
- FastAPI should continue to use `StreamingResponse` plus a custom async generator

## Old Designs Explicitly Deprecated

- Single-step tool selection driven by keywords and regex
- A main orchestration framework centered around `providers/`
- A standalone document extraction chain centered on `DocumentReference`
- Mixing "analysis suggestions" and "structured record entry" into one write path without approval
