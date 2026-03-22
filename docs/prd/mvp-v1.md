# KinCare MVP v1 - Product Requirements Document

> KinCare is a privately hosted AI family health space. This document describes the current product scope and core capabilities.

## Product Positioning

KinCare is a privately hosted AI family health management assistant. Each deployment instance serves one family, aggregates household health information, and provides a family dashboard, structured health records, AI chat, daily summaries and reminders, permission management, and session restoration.

## MVP v1 Scope

### F1: Family Space And Member Permissions

**Overview:** One KinCare instance = one family space.

**Features:**

- F1.1 User registration and login
  - The first registered user automatically becomes the family administrator
  - Later users join the same family space
- F1.2 Administrator adds members
  - Supports account-less members, such as elderly people and children
  - Members can bind an account later
- F1.3 Three-level permission model
  - Administrators have full capabilities
  - Normal members can by default view only directory-level basic information
  - Health data authorization uses `read / write / manage`
  - Authorization supports `specific` single-member and `all` all-member scope
- F1.4 Permission management UI
  - Administrators or users with `manage` capability can view, grant, and revoke authorizations

### F2: Family Dashboard And Member Profiles

**Overview:** The home page and member overview share the same summary and reminder semantics.

**Features:**

- F2.1 Family dashboard
  - The home page shows member status, permission summaries, AI summaries, and today's reminders in a household-wide aggregated view
  - Today's reminders are grouped by time slot
- F2.2 Member profiles
  - View member basic info, observations, sleep, workouts, conditions, medications, encounters, and AI summaries in one unified place
- F2.3 Manual editing
  - `FamilyMember`, `Observation`, `Condition`, `Medication`, `Encounter`, `SleepRecord`, and `WorkoutRecord` support manual editing from the frontend
  - Editing permission is controlled by member-level authorization
- F2.4 Health data semantics
  - `HealthSummary` supports AI-defined topics and `good / warning / alert` status
  - `CarePlan` supports `time_slot`, `icon_key`, assignee member, and notes

### F3: AI Chat, Voice, And Write-Back

**Overview:** AI provides controlled conversational capabilities based on member-level permissions and health records.

**Features:**

- F3.1 Unified conversation entrypoint
  - Supports text, voice, and attachment input as chat context
  - Voice enters the same input box through Web Audio API plus backend STT transcription
- F3.2 Structured draft confirmation
  - AI can generate drafts for Observation, Condition, Medication, Encounter, and similar records from chat
  - High-risk writes must be confirmed
- F3.3 Unified suggestion and write-back structure
  - Suggestions and drafts share `HealthRecordAction`
  - Supports `create / update / delete`
  - Suggestions must target an existing record section and carry the target member
- F3.4 Daily health summaries and reminders
  - AI generates flexible `HealthSummary` outputs for members every day
  - AI refreshes multiple `CarePlan` items every day
  - The home page and member overview display these results

### F4: Session History

**Overview:** Chat is not a disposable input box, but a recoverable family health workflow.

**Features:**

- F4.1 Session list
  - Shows history sessions sorted by updated time descending
  - Returns title, summary, and updated time
- F4.2 Session restoration
  - Users can restore full message history and current context
- F4.3 Automatic title / summary
  - Generates a readable title and short summary after session creation

### F6: System Settings

**Overview:** Users can adjust personal preferences and system runtime parameters through the settings sheet without editing server-side files.

**Features:**

- F6.1 Preferences (all users)
  - **Language:** supports Chinese and English UI language, takes effect globally immediately after switching, and stores the preference in `localStorage`
  - **Time** (editable by admins only): configures the daily health status refresh time, the trigger time for `HealthSummary` generation, and the daily reminder refresh time, the trigger time for `CarePlan` generation; these are read by the scheduler at runtime
  - **Appearance:** supports light, dark, and system themes, with preferences stored in `localStorage`
- F6.2 AI Config (admins only)
  - **Speech transcription:** configures STT provider parameters such as `openai / local_whisper`, `api_key`, `model`, and `language`
  - **Chat model:** configures the LLM `base_url`, `api_key`, and `model`
  - Configuration is persisted in the `system_config` database table, takes precedence over `.env` defaults at runtime, and applies on the next request after saving
  - `api_key`-like fields are shown in masked form; deployment-level configuration such as database connection, ports, and JWT secrets is outside the scope of this UI

### F5: Deployment And Extension

**Overview:** The official end-user installation path is single-machine Docker Compose, while local FastAPI + Vite remains the primary development workflow.

**Features:**

- F5.1 Local development runtime
  - Local SQLite
  - Start frontend and backend separately
- F5.2 Official installation path
  - `docker-compose.yml` is the self-hosted single-machine installation entrypoint
  - MCP remains an optional later external capability exposure layer

## Non-Functional Requirements

| Dimension | Requirement |
|---|---|
| Privacy | Local storage by default, with external calls limited to necessary dependencies such as model services |
| Security | Strict member-level permission control; AI must not bypass the service layer |
| Performance | Designed for family-scale usage scenarios and does not require high-concurrency architecture |
| Availability | Local deployments can tolerate short outages, but data must remain recoverable |
| Extensibility | Preserve room for future device integration, MCP, and deployment upgrades |

## UI Reference

- The product UI centers on the family dashboard, unified input area, member profiles, and permission panels
- `stitch-screens/` is kept only as an early reference and is no longer the current UI target

## Success Criteria

1. Users can register, log in, and manage family members and authorization relationships
2. The home page can show AI summaries, reminders, and a history-session entrypoint for the whole family
3. Member profiles can display and manually edit core health information
4. AI can answer questions, give suggestions, generate drafts, and confirm write-back within the allowed permission scope
5. Voice input can enter the unified conversation flow and be transcribed into text
6. Users can switch language and appearance in the Preferences tab, while administrators can also configure daily refresh times; administrators can manage speech transcription and chat model runtime parameters in the AI Config tab
7. Documentation and implementation continue to follow the current simplified health fact layer, PydanticAI orchestration, and three-level permission model
