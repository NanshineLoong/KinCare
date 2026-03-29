# Design: Demo Daily Re-seed & Env Settings Privacy

**Date:** 2026-03-29
**Status:** Approved

---

## Overview

Two independent features:

1. **Demo Daily Re-seed** — automatically re-seed demo data (family + system config) on each deployment and daily at 03:00 CST.
2. **Env Settings Privacy** — settings values sourced from `.env` must not be sent to the frontend; instead expose a `source` field so the UI can render a "configured via environment" badge without leaking API keys.

---

## Feature 1: Demo Daily Re-seed

### Goals

- After each deploy to `main`, the server automatically runs the seed script so demo users always start fresh.
- Every day at 03:00 CST (19:00 UTC), the seed script runs again.
- Seeding resets **all** family data **and** `system_config`, so the system reverts entirely to `.env` defaults.

### Architecture

**New file:** `.github/workflows/seed.yml`

```
Triggers:
  - schedule: '0 19 * * *'   (daily 03:00 CST)
  - workflow_dispatch         (manual)
  - workflow_call             (called by deploy.yml after deploy)

Job: seed
  - SSH to server
  - docker compose exec -T api python scripts/seed_demo_data.py
```

**`deploy.yml` change:** add a `seed` job after the `deploy` job, using `uses: ./.github/workflows/seed.yml` (`workflow_call`).

### Backend Change: include `system_config` in reset

`demo_seed.py` — add `"system_config"` to `RESET_TABLES`:

```python
RESET_TABLES: Sequence[str] = (
    "chat_message",
    ...
    "system_config",   # ← new
    "family_space",
)
```

This ensures every seed wipes any UI-saved config overrides, reverting to `.env` defaults.

### Seed Script Invocation in Container

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  exec -T api python scripts/seed_demo_data.py
```

The `-T` flag disables pseudo-TTY (required for non-interactive SSH).

### Error Handling

- The seed job is non-blocking for deployment — it runs **after** `deploy` succeeds, as a separate job.
- If seed fails (e.g. container not ready), the deploy is not rolled back; the failure is visible in GitHub Actions.
- A short `sleep 10` before the docker exec gives the container time to fully start after a fresh deploy.

---

## Feature 2: Env Settings Privacy

### Goals

- `GET /api/admin/settings` must **not** return actual values for fields sourced from `.env`.
- For each sensitive field, the response includes a `*_source` sibling: `"env"`, `"db"`, or `null` (not configured at all).
- Frontend: if `source == "env"`, display the field empty with a small badge "来自环境变量"; allow user to type a value to override (saves to DB).
- Frontend: if user clears a DB-overridden field and saves (sends `null`), backend deletes the DB record; next fetch returns `source: "env"` again.

### Sensitive Fields

| Section | Field | Tracked |
|---|---|---|
| `chat_model` | `api_key` | ✅ |
| `chat_model` | `base_url` | ✅ |
| `chat_model` | `model` | ✅ (for consistency; model is not secret but may differ from env default) |
| `transcription` | `api_key` | ✅ |
| `transcription` | STT base_url | N/A — STT base_url is never returned directly (it follows ai fallback flag) |

### Backend Schema Changes (`admin_settings.py`)

```python
class ChatModelSettingsRead(BaseModel):
    base_url: str | None          # null if source == "env"
    base_url_source: Literal["env", "db"] | None
    api_key: str | None           # null if source == "env"
    api_key_source: Literal["env", "db"] | None
    model: str
    model_source: Literal["env", "db"] | None

class TranscriptionSettingsRead(BaseModel):
    ...existing fields...
    api_key: str | None           # null if source == "env"
    api_key_source: Literal["env", "db"] | None
```

### Backend Serialization Logic (`system_config.py`)

Helper to determine source:

```python
def _field_source(
    values: dict[str, str],
    key: str,
    env_value: str | None,
) -> tuple[str | None, Literal["env", "db"] | None]:
    if key in values:
        return values[key] or None, "db"
    if env_value:
        return None, "env"       # ← don't send the value
    return None, None
```

Applied in `_serialize_admin_settings` for `ai_api_key`, `ai_base_url`, `ai_model`, `stt_api_key`.

### Frontend Type Changes (`adminSettings.ts`)

```typescript
export type AdminSettings = {
  ...
  chat_model: {
    base_url: string | null;
    base_url_source: "env" | "db" | null;
    api_key: string | null;
    api_key_source: "env" | "db" | null;
    model: string;
    model_source: "env" | "db" | null;
  };
  transcription: {
    ...
    api_key: string | null;
    api_key_source: "env" | "db" | null;
    ...
  };
};
```

### Frontend UX (`SettingsSheet.tsx`)

**Loading settings:** when `source == "env"`, set the local state to `""` (empty string) — do NOT populate with the returned null. Store the source in a parallel state variable.

```typescript
const [chatApiKeySource, setChatApiKeySource] = useState<"env" | "db" | null>(null);
// on load:
setChatApiKey(nextSettings.chat_model.api_key ?? "");
setChatApiKeySource(nextSettings.chat_model.api_key_source ?? null);
```

**Badge rendering:** shown below the label when `source == "env"` AND the local input is empty:

```tsx
{chatApiKeySource === "env" && !chatApiKey && (
  <EnvConfiguredBadge />
)}
```

**Badge style:** blue tint (distinct from the green "already found local model" badge), label: `来自环境变量`.

**Save warning:** when `api_key_source !== "env"` (i.e., user has entered a value or is about to), show a small hint: `"填写后将保存至数据库"`.

**Clearing a DB override:** user deletes content → local state becomes `""` → on save, send `api_key: null` → backend deletes DB record → next GET returns `source: "env"` → badge reappears.

---

## Data Flow Summary

```
.env (KINCARE_AI_API_KEY=sk-xxx)
  └─→ settings.ai_api_key = "sk-xxx"

GET /api/admin/settings
  if ai_api_key NOT in system_config table:
    → response: { api_key: null, api_key_source: "env" }
  if ai_api_key IN system_config table (user overrode it):
    → response: { api_key: "user-value", api_key_source: "db" }

PUT /api/admin/settings { chat_model: { api_key: null } }
  → DELETE FROM system_config WHERE key = 'ai_api_key'
  → next GET returns source: "env" again

Demo seed (daily / on deploy):
  → DELETE FROM system_config (all rows)
  → DELETE FROM family_space (cascade resets all user data)
  → Insert fresh Carter family demo data
  → System reverts to .env config
```

---

## Out of Scope

- No UI to "force clear" env values from the server (would require SSH / .env edit).
- No masking/hashing of DB-stored keys in the API response (DB keys are shown in full to the admin who set them).
- No multi-tenant isolation — this is a single-family demo instance.
