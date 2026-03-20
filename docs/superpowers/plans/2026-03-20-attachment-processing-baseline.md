# Attachment Processing Baseline Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real attachment-processing baseline for AI chat that supports audio, images, PDF, DOC, and DOCX, plus drag-and-drop and pasted-image upload in the shared chat composer.

**Architecture:** Add a dedicated attachment parsing layer on the backend instead of overloading speech transcription. Parse files through a registry-backed service, inject only bounded attachment excerpts into the existing chat runtime, and keep the current approval and service-layer write flow unchanged. On the frontend, unify file selection, drag-and-drop, pasted-image upload, and audio upload under one attachment handler shared by home and overlay chat entry points.

**Tech Stack:** FastAPI, Pydantic, Docling, React, Vite, Vitest, pytest

---

## Chunk 1: Backend Attachment Parsing

### Task 1: Add failing tests for attachment parsing API behavior

**Files:**
- Modify: `backend/tests/test_phase4_ai.py`
- Test: `backend/tests/test_phase4_ai.py`

- [ ] **Step 1: Write the failing tests**

```python
def test_attachment_endpoint_routes_audio_to_transcription(...): ...
def test_attachment_endpoint_routes_pdf_to_docling_parser(...): ...
def test_attachment_endpoint_rejects_unsupported_files(...): ...
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && UV_CACHE_DIR=/tmp/homevital-uv-cache uv run --no-project --with-requirements requirements-dev.txt pytest backend/tests/test_phase4_ai.py -k 'attachment_endpoint' -q`
Expected: FAIL because `/api/chat/attachments` and parser wiring do not exist yet

- [ ] **Step 3: Write minimal implementation**

Create attachment schema, service, and route. Route audio to existing STT path, route parseable documents to Docling adapter, and return bounded excerpts plus suggested text.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && UV_CACHE_DIR=/tmp/homevital-uv-cache uv run --no-project --with-requirements requirements-dev.txt pytest backend/tests/test_phase4_ai.py -k 'attachment_endpoint' -q`
Expected: PASS

### Task 2: Add failing tests for chat attachment context injection

**Files:**
- Modify: `backend/tests/test_phase4_ai.py`
- Modify: `backend/app/schemas/chat.py`
- Modify: `backend/app/ai/deps.py`
- Modify: `backend/app/ai/agent.py`
- Modify: `backend/app/ai/orchestrator.py`

- [ ] **Step 1: Write the failing test**

```python
def test_chat_message_can_include_attachment_context(...): ...
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && UV_CACHE_DIR=/tmp/homevital-uv-cache uv run --no-project --with-requirements requirements-dev.txt pytest backend/tests/test_phase4_ai.py -k 'attachment_context' -q`
Expected: FAIL because chat message payload does not accept attachments and agent deps lack attachment context

- [ ] **Step 3: Write minimal implementation**

Add attachment payload schema, persist attachment metadata with the user message, inject summarized attachment context into `AIDeps`, and append a compact attachment section to the system prompt.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && UV_CACHE_DIR=/tmp/homevital-uv-cache uv run --no-project --with-requirements requirements-dev.txt pytest backend/tests/test_phase4_ai.py -k 'attachment_context' -q`
Expected: PASS

## Chunk 2: Frontend Shared Attachment UX

### Task 3: Add failing tests for `ChatInput` attachment interactions

**Files:**
- Modify: `frontend/src/components/ChatInput.test.tsx`
- Modify: `frontend/src/components/ChatInput.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
it("uploads selected files through the shared attachment handler", ...)
it("supports drag and drop upload", ...)
it("supports pasted image upload", ...)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- ChatInput.test.tsx`
Expected: FAIL because the component only exposes audio upload and has no drag/paste handling

- [ ] **Step 3: Write minimal implementation**

Refactor `ChatInput` to use `onAttachmentUpload`, expose attachment chips, add drop zone highlighting, and handle clipboard image files.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- ChatInput.test.tsx`
Expected: PASS

### Task 4: Add failing tests for home/app attachment wiring

**Files:**
- Modify: `frontend/src/pages/HomePage.test.tsx`
- Modify: `frontend/src/App.test.tsx`
- Modify: `frontend/src/api/chat.ts`
- Modify: `frontend/src/pages/HomePage.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
it("parses uploaded attachments into the home composer", ...)
it("parses uploaded attachments into the chat overlay composer", ...)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- HomePage.test.tsx App.test.tsx`
Expected: FAIL because the UI still calls `transcribeAudio()` directly for all files

- [ ] **Step 3: Write minimal implementation**

Add `parseAttachment()` API client, update home and overlay upload handlers to route files by type, append suggested text to draft state, and keep audio working.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- HomePage.test.tsx App.test.tsx`
Expected: PASS

## Chunk 3: Verification and Documentation

### Task 5: Verify integrated behavior and document new config

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Add required dependency and config docs**

Document Docling installation and optional local artifacts path configuration.

- [ ] **Step 2: Run focused backend verification**

Run: `cd backend && UV_CACHE_DIR=/tmp/homevital-uv-cache uv run --no-project --with-requirements requirements-dev.txt pytest backend/tests/test_phase4_ai.py -q`
Expected: PASS

- [ ] **Step 3: Run focused frontend verification**

Run: `cd frontend && npm test -- ChatInput.test.tsx HomePage.test.tsx App.test.tsx`
Expected: PASS

- [ ] **Step 4: Run a final integrated status check**

Run: `git status --short`
Expected: only intended files changed
