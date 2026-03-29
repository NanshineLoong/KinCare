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

- After each successful deploy to `main`, the server automatically runs the seed script.
- Every day at 03:00 CST (19:00 UTC), the seed script runs again.
- Seeding resets **all** family data **and** `system_config` (0 rows after seed), so the system reverts entirely to `.env` defaults.

### Backend Change: include `system_config` in reset

`demo_seed.py` — add `"system_config"` to `RESET_TABLES` (insert before `"family_space"` to respect FK ordering):

```python
RESET_TABLES: Sequence[str] = (
    "chat_message",
    "chat_session",
    "care_plan",
    "health_summary",
    "workout_record",
    "sleep_record",
    "encounter",
    "medication",
    "condition",
    "observation",
    "scheduled_task",
    "member_access_grant",
    "family_member",
    "user_account",
    "system_config",   # ← new: wiped on every seed
    "family_space",
)
```

After seeding, `system_config` must have **0 rows**. The demo does not write any initial config rows; all config falls back to `.env` values.

### Test Update (`test_demo_seed.py`)

The existing test `test_seed_demo_family_replaces_existing_family_data_and_preserves_system_config` must be renamed and its assertion updated:

- **New name:** `test_seed_demo_family_replaces_existing_family_data_and_clears_system_config`
- **New assertion:** after seed, `system_config` row count == 0 (not 1).
- The pre-inserted `"ui.language"` fixture row should still be inserted before seed to confirm it is deleted.

### `seed_demo_family` Signature

The function signature remains `seed_demo_family(database: Database) -> dict[str, Any]`. No `settings` parameter is needed for this feature; `system_config` is deleted, not written. The call site in `scripts/seed_demo_data.py` requires no change.

### Architecture: New `seed.yml`

**New file:** `.github/workflows/seed.yml`

```yaml
name: Seed Demo Data

on:
  schedule:
    - cron: '0 19 * * *'   # daily 03:00 CST = 19:00 UTC
  workflow_dispatch:
  workflow_call:             # called by deploy.yml after deploy

env:
  DEPLOY_PATH: /opt/kincare

jobs:
  seed:
    name: Seed Demo Data
    runs-on: ubuntu-latest
    steps:
      - name: Install SSH key
        shell: bash
        env:
          SSH_HOST: ${{ secrets.SSH_HOST }}
          SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
        run: |
          mkdir -p ~/.ssh
          chmod 700 ~/.ssh
          printf '%s\n' "$SSH_PRIVATE_KEY" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          ssh-keyscan -H "$SSH_HOST" >> ~/.ssh/known_hosts

      - name: Run seed script in container
        shell: bash
        env:
          SSH_HOST: ${{ secrets.SSH_HOST }}
          SSH_USER: ${{ secrets.SSH_USER }}
        run: |
          ssh "$SSH_USER@$SSH_HOST" "
            set -e
            cd '${{ env.DEPLOY_PATH }}'
            # Wait for container to be healthy after a fresh deploy
            for i in \$(seq 1 12); do
              docker compose -f docker-compose.yml -f docker-compose.prod.yml \
                exec -T api echo ok && break || sleep 5
            done
            docker compose -f docker-compose.yml -f docker-compose.prod.yml \
              exec -T api python scripts/seed_demo_data.py
          "
```

Secrets are referenced directly (no `secrets: inherit` needed since this workflow accesses them in the same repo).

### `deploy.yml` Change

Add a `seed` job after the `deploy` job:

```yaml
  seed:
    name: Seed Demo Data After Deploy
    needs: deploy
    if: needs.deploy.result == 'success'
    uses: ./.github/workflows/seed.yml
    secrets: inherit
```

The seed job runs only if deploy succeeded (`if: needs.deploy.result == 'success'`). If seed fails, the deployment is not rolled back; the failure is visible in GitHub Actions.

---

## Feature 2: Env Settings Privacy

### Goals

- `GET /api/admin/settings` must **not** return actual values for fields sourced from `.env`.
- For each sensitive field, the response includes a `*_source` sibling: `"env"`, `"db"`, or `null` (not configured at all).
- Frontend: if `source == "env"`, display the field empty with a small badge "来自环境变量"; allow user to type a value to override (saves to DB).
- Frontend: if user clears a DB-overridden field and saves (sends `null`), backend deletes the DB record; next fetch returns `source: "env"` again.

### Sensitive Fields

| Section | Field | source tracked |
|---|---|---|
| `chat_model` | `api_key` | ✅ |
| `chat_model` | `base_url` | ✅ |
| `chat_model` | `model` | ✅ (for consistency; model is not secret) |
| `transcription` | `api_key` | ✅ with fallback handling (see below) |

### Backend Schema Changes (`admin_settings.py`) — new fields, in scope

`ChatModelSettingsRead` and `TranscriptionSettingsRead` are updated (these are new fields, currently absent from the file):

```python
class ChatModelSettingsRead(BaseModel):
    base_url: str | None          # null if source == "env"
    base_url_source: Literal["env", "db"] | None
    api_key: str | None           # null if source == "env"
    api_key_source: Literal["env", "db"] | None
    model: str
    model_source: Literal["env", "db"] | None

class TranscriptionSettingsRead(BaseModel):
    # ...existing fields unchanged...
    api_key: str | None           # null if source == "env"
    api_key_source: Literal["env", "db"] | None
    # (other fields like model, language, etc. are not sensitive, no source needed)
```

### Backend Serialization Logic (`system_config.py`)

Add a helper to determine source for simple fields:

```python
def _field_source(
    values: dict[str, str],
    key: str,
    env_value: str | None,
) -> tuple[str | None, Literal["env", "db"] | None]:
    """Returns (value_to_send, source). Never sends env values."""
    if key in values:
        return values[key] or None, "db"
    if env_value:
        return None, "env"
    return None, None
```

**STT api_key fallback special case:** `stt_api_key` may fall back to `ai_api_key` when `stt_api_key_uses_ai_fallback` is True. The source is computed as:

```python
def _stt_api_key_field_source(
    values: dict[str, str],
    settings: Settings,
) -> tuple[str | None, Literal["env", "db"] | None]:
    if STT_API_KEY_KEY in values:
        return values[STT_API_KEY_KEY] or None, "db"
    if settings.stt_api_key_uses_ai_fallback:
        # Delegates to ai_api_key chain
        return _field_source(values, AI_API_KEY_KEY, settings.ai_api_key)
    if settings.stt_api_key:
        return None, "env"
    return None, None
```

Apply these in `_serialize_admin_settings`:

```python
chat_api_key, chat_api_key_source = _field_source(values, AI_API_KEY_KEY, settings.ai_api_key)
chat_base_url, chat_base_url_source = _field_source(values, AI_BASE_URL_KEY, settings.ai_base_url)
chat_model_val, chat_model_source = _field_source(values, AI_MODEL_KEY, settings.ai_model)
stt_api_key_val, stt_api_key_source = _stt_api_key_field_source(values, settings)

return {
    ...time_settings,
    "chat_model": {
        "base_url": chat_base_url,
        "base_url_source": chat_base_url_source,
        "api_key": chat_api_key,
        "api_key_source": chat_api_key_source,
        "model": chat_model_val or settings.ai_model,
        "model_source": chat_model_source,
    },
    "transcription": {
        ...existing fields...
        "api_key": stt_api_key_val,
        "api_key_source": stt_api_key_source,
    },
}
```

Note: `chat_model.model` must still return the effective model string (never null), so `model_source` is informational only; the value is always returned.

### Frontend Type Changes (`adminSettings.ts`) — in scope, currently absent

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
    // ...existing fields...
    api_key: string | null;
    api_key_source: "env" | "db" | null;
    // ...
  };
};
```

### Frontend UX (`SettingsSheet.tsx`) — all additions, none currently exist

**New state variables** (parallel to existing `chatApiKey`, `chatBaseUrl`, etc.):

```typescript
const [chatApiKeySource, setChatApiKeySource] = useState<"env" | "db" | null>(null);
const [chatBaseUrlSource, setChatBaseUrlSource] = useState<"env" | "db" | null>(null);
const [chatModelSource, setChatModelSource] = useState<"env" | "db" | null>(null);
const [sttApiKeySource, setSttApiKeySource] = useState<"env" | "db" | null>(null);
```

**`applyAdminSettings` function** — update both on initial load AND on save response (called after every PUT response):

```typescript
function applyAdminSettings(nextSettings: AdminSettings) {
  setChatBaseUrl(nextSettings.chat_model.base_url ?? "");
  setChatBaseUrlSource(nextSettings.chat_model.base_url_source ?? null);
  setChatApiKey(nextSettings.chat_model.api_key ?? "");
  setChatApiKeySource(nextSettings.chat_model.api_key_source ?? null);
  setChatModel(nextSettings.chat_model.model);
  setChatModelSource(nextSettings.chat_model.model_source ?? null);
  setSttApiKey(nextSettings.transcription.api_key ?? "");
  setSttApiKeySource(nextSettings.transcription.api_key_source ?? null);
  // ...other existing fields...
}
```

**Badge rendering** — `EnvConfiguredBadge` is a new inline component (not currently in the file), shown when `source == "env"` AND the local input is empty:

```tsx
function EnvConfiguredBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
      来自环境变量
    </span>
  );
}

// Usage at each sensitive field:
{chatApiKeySource === "env" && !chatApiKey && <EnvConfiguredBadge />}
```

**Save hint** — show when the user has entered text into an env-configured field (they are about to override it):

```tsx
{chatApiKeySource === "env" && chatApiKey && (
  <p className="text-xs text-amber-600">填写后将保存至数据库</p>
)}
```

**Clearing a DB override:** user deletes content → local state `""` → on save, send `api_key: null` → backend deletes DB record → next GET returns `source: "env"` → badge reappears. No special UI needed; the existing save path already sends `null` for empty strings.

### Frontend Tests (`SettingsSheet.test.tsx`) — in scope

The existing `defaultAdminSettings` fixture does not include `*_source` fields. Update the fixture to add source fields:

```typescript
const defaultAdminSettings = {
  ...existing,
  chat_model: {
    base_url: null,
    base_url_source: null,
    api_key: null,
    api_key_source: null,
    model: "gpt-4.1-mini",
    model_source: null,
  },
  transcription: {
    ...existing.transcription,
    api_key: null,
    api_key_source: null,
  },
};
```

Add test cases:
- Badge renders when `api_key_source: "env"` and value is null.
- Badge does not render when `api_key_source: "db"` and value is present.
- Save hint renders when `api_key_source: "env"` and user has typed a value.

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
  → DELETE FROM system_config (all rows → 0 rows)
  → DELETE FROM family_space (cascade resets all user data)
  → Insert fresh Carter family demo data
  → System reverts to .env config
```

---

## Out of Scope

- No UI to "force clear" env values from the server (would require SSH / .env edit).
- No masking/hashing of DB-stored keys in the API response (DB keys are shown in full to the admin who set them).
- No multi-tenant isolation — this is a single-family demo instance.
- `transcription.model`, `transcription.language`, and other non-sensitive transcription fields do not get `*_source` treatment.
