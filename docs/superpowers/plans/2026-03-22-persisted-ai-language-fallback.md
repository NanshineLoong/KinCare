# Persisted AI Language Fallback Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist AI language preferences so no-request daily generation resolves output language as user preference, then family default, then English.

**Architecture:** Add a user-level `preferred_language` field on `user_account`, add a family-level default AI language in `system_config`, and centralize resolution logic in the backend scheduler/runtime path. Extend auth/session and settings APIs so the frontend can persist the user preference from `Preferences` and the admin can manage the family fallback language.

**Tech Stack:** FastAPI, SQLite, React, TypeScript, pytest, Vitest

---

## Chunk 1: Persistence Surfaces

### Task 1: Add persisted user and family language storage

**Files:**
- Modify: `backend/app/core/database.py`
- Modify: `backend/app/services/repository.py`
- Modify: `backend/app/services/system_config.py`
- Test: `backend/tests/test_phase1_auth_members.py`

- [ ] Write failing backend tests for user language persistence and family default lookup.
- [ ] Run the targeted backend tests and confirm they fail for missing storage fields/helpers.
- [ ] Add the new database column and system config key with compatibility-safe migration.
- [ ] Re-run the targeted backend tests and confirm they pass.

### Task 2: Expose persistence through APIs

**Files:**
- Modify: `backend/app/schemas/auth.py`
- Modify: `backend/app/core/dependencies.py`
- Modify: `backend/app/api/routes/auth.py`
- Modify: `backend/app/schemas/admin_settings.py`
- Modify: `backend/app/api/routes/admin_settings.py`
- Test: `backend/tests/test_phase1_auth_members.py`

- [ ] Add failing backend tests for updating user language preference and reading/updating family default AI language.
- [ ] Run the targeted backend tests and confirm they fail.
- [ ] Implement the minimal API/schema changes.
- [ ] Re-run the targeted backend tests and confirm they pass.

## Chunk 2: Language Resolution

### Task 3: Resolve no-request daily generation language from persisted settings

**Files:**
- Modify: `backend/app/ai/scheduler.py`
- Modify: `backend/app/services/health_records.py`
- Modify: `backend/tests/test_phase4_ai.py`

- [ ] Add failing backend tests covering: bound user preference wins, family default is used for unbound members, and English remains the final fallback.
- [ ] Run the targeted backend tests and confirm they fail.
- [ ] Implement language resolution in the scheduler for no-request generation paths.
- [ ] Re-run the targeted backend tests and confirm they pass.

## Chunk 3: Frontend Sync

### Task 4: Persist user preference and admin family default from settings UI

**Files:**
- Modify: `frontend/src/auth/session.ts`
- Modify: `frontend/src/api/auth.ts`
- Modify: `frontend/src/api/adminSettings.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/SettingsSheet.tsx`
- Modify: `frontend/src/components/SettingsSheet.test.tsx`
- Modify: `frontend/src/App.test.tsx`

- [ ] Add failing frontend tests for syncing user language preference and editing family default AI language.
- [ ] Run the targeted frontend tests and confirm they fail.
- [ ] Implement the minimal frontend changes.
- [ ] Re-run the targeted frontend tests and confirm they pass.

## Chunk 4: Verification

### Task 5: Run relevant verification

**Files:**
- Test: `backend/tests/test_phase1_auth_members.py`
- Test: `backend/tests/test_phase4_ai.py`
- Test: `frontend/src/App.test.tsx`
- Test: `frontend/src/components/SettingsSheet.test.tsx`
- Test: `frontend/src/pages/HomePage.test.tsx`

- [ ] Run targeted backend auth and AI tests.
- [ ] Run targeted frontend settings and app tests.
- [ ] Run broader relevant backend/frontend subsets if the targeted checks are green.
- [ ] Record any remaining gaps if something broader is not run.
