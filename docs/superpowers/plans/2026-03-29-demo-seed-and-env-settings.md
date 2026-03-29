# Demo Daily Re-seed & Env Settings Privacy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Auto-seed demo data on every deploy and daily at 03:00 CST, wiping system_config so config reverts to `.env`; (2) Never expose `.env` API key values to the frontend — return a `source` field instead so the UI can show a "来自环境变量" badge.

**Architecture:** Feature 1 adds `system_config` to `RESET_TABLES` and a new `seed.yml` GitHub Actions workflow called by `deploy.yml` after deploy. Feature 2 adds `*_source` fields to the settings API response (never returning env-sourced values), with corresponding TypeScript types and a badge in `SettingsSheet`.

**Tech Stack:** Python/Pydantic (backend), TypeScript/React (frontend), GitHub Actions (CI/CD), Docker Compose (deployment)

---

## Files Changed

| File | Change |
|---|---|
| `backend/app/services/demo_seed.py` | Add `"system_config"` to `RESET_TABLES` |
| `backend/tests/test_demo_seed.py` | Rename test; assert `system_config == 0` after seed |
| `backend/app/schemas/admin_settings.py` | Add `*_source` fields to `ChatModelSettingsRead` and `TranscriptionSettingsRead` |
| `backend/app/services/system_config.py` | Add `_field_source` + `_stt_api_key_field_source` helpers; update `_serialize_admin_settings` |
| `backend/tests/test_phase1_auth_members.py` | Update any admin settings API test that checks `chat_model`/`transcription` response shape |
| `frontend/src/api/adminSettings.ts` | Add `*_source` fields to `AdminSettings` type |
| `frontend/src/components/SettingsSheet.tsx` | Add source state vars, update `applyAdminSettings`, add `EnvConfiguredBadge`, render badges and save hints |
| `frontend/src/components/SettingsSheet.test.tsx` | Update `defaultAdminSettings` fixture; add badge/hint tests |
| `.github/workflows/seed.yml` | New: daily + workflow_call seed job |
| `.github/workflows/deploy.yml` | Add `seed` job after `deploy` |

---

## Task 1: Reset `system_config` on Demo Seed (Backend)

**Files:**
- Modify: `backend/app/services/demo_seed.py:15-31`
- Modify: `backend/tests/test_demo_seed.py:11-91`

- [ ] **Step 1: Update the failing test first**

In `backend/tests/test_demo_seed.py`:

1. Rename the function at line 11:
   - Old: `test_seed_demo_family_replaces_existing_family_data_and_preserves_system_config`
   - New: `test_seed_demo_family_replaces_existing_family_data_and_clears_system_config`

2. Change the `system_config` assertion at line 90:
   - Old: `"system_config": 1,`
   - New: `"system_config": 0,`

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd backend
UV_CACHE_DIR=/tmp/kincare-uv-cache uv run --no-project --with-requirements requirements-dev.txt \
  pytest tests/test_demo_seed.py::test_seed_demo_family_replaces_existing_family_data_and_clears_system_config -v
```

Expected: FAIL — `assert 1 == 0`

- [ ] **Step 3: Add `system_config` to RESET_TABLES**

In `backend/app/services/demo_seed.py`, update `RESET_TABLES` (lines 15-31):

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
    "system_config",
    "family_space",
)
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
cd backend
UV_CACHE_DIR=/tmp/kincare-uv-cache uv run --no-project --with-requirements requirements-dev.txt \
  pytest tests/test_demo_seed.py -v
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/demo_seed.py backend/tests/test_demo_seed.py
git commit -m "feat(demo): clear system_config on seed so config reverts to .env defaults"
```

---

## Task 2: GitHub Actions — `seed.yml` + `deploy.yml` Update

**Files:**
- Create: `.github/workflows/seed.yml`
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create `.github/workflows/seed.yml`**

```yaml
name: Seed Demo Data

on:
  schedule:
    - cron: '0 19 * * *'   # daily 03:00 CST = 19:00 UTC
  workflow_dispatch:
  workflow_call:

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
            for i in \$(seq 1 12); do
              docker compose -f docker-compose.yml -f docker-compose.prod.yml \
                exec -T api echo ok && break || sleep 5
            done
            docker compose -f docker-compose.yml -f docker-compose.prod.yml \
              exec -T api python scripts/seed_demo_data.py
          "
```

- [ ] **Step 2: Add seed job to `deploy.yml`**

Append to `.github/workflows/deploy.yml` after the `deploy` job (after line 135):

```yaml
  seed:
    name: Seed Demo Data After Deploy
    needs: deploy
    if: needs.deploy.result == 'success'
    uses: ./.github/workflows/seed.yml
    secrets: inherit
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/seed.yml .github/workflows/deploy.yml
git commit -m "feat(ci): add daily demo seed workflow; trigger seed after successful deploy"
```

---

## Task 3: Backend Schema — Add `*_source` Fields

**Files:**
- Modify: `backend/app/schemas/admin_settings.py`

- [ ] **Step 1: Update `ChatModelSettingsRead`**

Current (lines 39-52):
```python
class ChatModelSettingsRead(BaseModel):
    base_url: str | None
    api_key: str | None
    model: str
```

Replace with:
```python
class ChatModelSettingsRead(BaseModel):
    base_url: str | None
    base_url_source: Literal["env", "db"] | None = None
    api_key: str | None
    api_key_source: Literal["env", "db"] | None = None
    model: str
    model_source: Literal["env", "db"] | None = None
```

- [ ] **Step 2: Update `TranscriptionSettingsRead`**

In `TranscriptionSettingsRead` (around line 67), insert one new line **after** `api_key: str | None`:

```python
    api_key_source: Literal["env", "db"] | None = None
```

Do NOT replace or remove any validators. Only insert this single field.

- [ ] **Step 3: Commit**

```bash
git add backend/app/schemas/admin_settings.py
git commit -m "feat(settings): add source fields to admin settings read schemas"
```

---

## Task 4: Backend Serialization — Source-Aware `_serialize_admin_settings`

**Files:**
- Modify: `backend/app/services/system_config.py`

- [ ] **Step 1: Add `_field_source` helper after `_effective_stt_base_url` (around line 131)**

```python
def _field_source(
    values: dict[str, str],
    key: str,
    env_value: str | None,
) -> tuple[str | None, Literal["env", "db"] | None]:
    """Returns (value_to_send, source). Never exposes env values."""
    if key in values:
        return values[key] or None, "db"
    if env_value:
        return None, "env"
    return None, None


def _stt_api_key_field_source(
    values: dict[str, str],
    settings: Settings,
) -> tuple[str | None, Literal["env", "db"] | None]:
    """Handles the STT api_key fallback chain through ai_api_key."""
    if STT_API_KEY_KEY in values:
        return values[STT_API_KEY_KEY] or None, "db"
    if settings.stt_api_key_uses_ai_fallback:
        return _field_source(values, AI_API_KEY_KEY, settings.ai_api_key)
    if settings.stt_api_key:
        return None, "env"
    return None, None
```

Also add the `Literal` import at the top of the file:
```python
from typing import Any, Literal
```
(The file currently has `from typing import Any` — just add `Literal`.)

- [ ] **Step 2: Update `_serialize_admin_settings` to use source helpers**

Replace the return block inside `_serialize_admin_settings` (lines 187-206):

```python
def _serialize_admin_settings(
    connection: sqlite3.Connection,
    *,
    settings: Settings,
) -> dict[str, Any]:
    values = _load_setting_values(connection)
    effective_settings = _load_runtime_settings_from_values(values, settings=settings)
    time_settings = _load_time_settings(connection, settings=settings, values=values)

    chat_api_key, chat_api_key_source = _field_source(values, AI_API_KEY_KEY, settings.ai_api_key)
    chat_base_url, chat_base_url_source = _field_source(values, AI_BASE_URL_KEY, settings.ai_base_url)
    chat_model_val, chat_model_source = _field_source(values, AI_MODEL_KEY, settings.ai_model)
    stt_api_key_val, stt_api_key_source = _stt_api_key_field_source(values, settings)

    return {
        **time_settings,
        "ai_default_language": values.get(AI_DEFAULT_LANGUAGE_KEY, DEFAULT_AI_OUTPUT_LANGUAGE),
        "transcription": {
            "provider": effective_settings.stt_provider,
            "api_key": stt_api_key_val,
            "api_key_source": stt_api_key_source,
            "model": effective_settings.stt_model,
            "language": effective_settings.stt_language,
            "timeout": effective_settings.stt_timeout_seconds,
            "local_whisper_model": effective_settings.local_whisper_model,
            "local_whisper_device": effective_settings.local_whisper_device,
            "local_whisper_compute_type": effective_settings.local_whisper_compute_type,
            "local_whisper_download_root": effective_settings.local_whisper_download_root,
        },
        "chat_model": {
            "base_url": chat_base_url,
            "base_url_source": chat_base_url_source,
            "api_key": chat_api_key,
            "api_key_source": chat_api_key_source,
            "model": chat_model_val or settings.ai_model,
            "model_source": chat_model_source,
        },
    }
```

- [ ] **Step 3: Run backend tests**

```bash
cd backend
UV_CACHE_DIR=/tmp/kincare-uv-cache uv run --no-project --with-requirements requirements-dev.txt \
  pytest tests/ -v
```

Expected: all PASS (Pydantic validates the new fields with `= None` defaults so existing tests still work, but check `test_phase1_auth_members.py` for any settings shape assertions — fix if needed)

- [ ] **Step 4: Fix any broken backend tests**

If `test_phase1_auth_members.py` has assertions on `chat_model` or `transcription` shape, update expected dicts to include the new `*_source` keys (all will be `None` in tests that don't set up env values).

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/system_config.py backend/tests/test_phase1_auth_members.py
git commit -m "feat(settings): serialize source fields; never expose env-sourced API keys"
```

---

## Task 5: Frontend Types — Add `*_source` to `AdminSettings`

**Files:**
- Modify: `frontend/src/api/adminSettings.ts:6-26`

- [ ] **Step 1: Update `AdminSettings` type**

Replace the `transcription` and `chat_model` shapes:

```typescript
export type AdminSettings = {
  health_summary_refresh_time: string;
  care_plan_refresh_time: string;
  ai_default_language: "zh" | "en";
  transcription: {
    provider: "openai" | "local_whisper";
    api_key: string | null;
    api_key_source: "env" | "db" | null;
    model: string;
    language: string | null;
    timeout: number;
    local_whisper_model: string;
    local_whisper_device: string;
    local_whisper_compute_type: string;
    local_whisper_download_root: string | null;
  };
  chat_model: {
    base_url: string | null;
    base_url_source: "env" | "db" | null;
    api_key: string | null;
    api_key_source: "env" | "db" | null;
    model: string;
    model_source: "env" | "db" | null;
  };
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/adminSettings.ts
git commit -m "feat(settings): add source fields to AdminSettings TypeScript type"
```

---

## Task 6: Frontend SettingsSheet — Source State, Badge, Hint

**Files:**
- Modify: `frontend/src/components/SettingsSheet.tsx`

- [ ] **Step 1: Add `EnvConfiguredBadge` component**

Add this small component just before the main `SettingsSheet` function export (search for `export function SettingsSheet`):

```tsx
function EnvConfiguredBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
      来自环境变量
    </span>
  );
}
```

- [ ] **Step 2: Add source state variables**

After the existing state declarations for `chatBaseUrl`, `chatApiKey`, `chatModel` (around line 1064-1066), add:

```typescript
const [chatBaseUrlSource, setChatBaseUrlSource] = useState<"env" | "db" | null>(null);
const [chatApiKeySource, setChatApiKeySource] = useState<"env" | "db" | null>(null);
const [chatModelSource, setChatModelSource] = useState<"env" | "db" | null>(null);
const [sttApiKeySource, setSttApiKeySource] = useState<"env" | "db" | null>(null);
```

- [ ] **Step 3: Update `applyAdminSettings`**

Replace the function (lines 1172-1193):

```typescript
function applyAdminSettings(nextSettings: AdminSettings) {
  setHealthSummaryRefreshTime(nextSettings.health_summary_refresh_time);
  setCarePlanRefreshTime(nextSettings.care_plan_refresh_time);
  setAiDefaultLanguage(nextSettings.ai_default_language);
  setSttProvider(nextSettings.transcription.provider);
  setSttApiKey(nextSettings.transcription.api_key ?? "");
  setSttApiKeySource(nextSettings.transcription.api_key_source ?? null);
  setSttModel(nextSettings.transcription.model);
  setSttLanguage(nextSettings.transcription.language ?? "");
  setSttTimeout(String(nextSettings.transcription.timeout));
  setLocalWhisperModel(nextSettings.transcription.local_whisper_model);
  setIsCustomLocalWhisperModel(
    !isPresetLocalWhisperModel(nextSettings.transcription.local_whisper_model),
  );
  setLocalWhisperDevice(nextSettings.transcription.local_whisper_device);
  setLocalWhisperComputeType(nextSettings.transcription.local_whisper_compute_type);
  setLocalWhisperDownloadRoot(
    nextSettings.transcription.local_whisper_download_root ?? "",
  );
  setChatBaseUrl(nextSettings.chat_model.base_url ?? "");
  setChatBaseUrlSource(nextSettings.chat_model.base_url_source ?? null);
  setChatApiKey(nextSettings.chat_model.api_key ?? "");
  setChatApiKeySource(nextSettings.chat_model.api_key_source ?? null);
  setChatModel(nextSettings.chat_model.model);
  setChatModelSource(nextSettings.chat_model.model_source ?? null);
}
```

- [ ] **Step 4: Add badge + hint to Chat Model section**

In the chat model section (around lines 2050-2093), update each label to include badge and hint. The pattern for each field is:

**Chat Base URL** (around line 2050):
```tsx
<label className="block text-sm font-medium text-[#2D2926]">
  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
    {t("settingsAiChatBaseUrl")}
    {chatBaseUrlSource === "env" && !chatBaseUrl && <EnvConfiguredBadge />}
  </div>
  {chatBaseUrlSource === "env" && chatBaseUrl && (
    <p className="mt-1 text-xs text-amber-600">填写后将保存至数据库</p>
  )}
  <input
    aria-label={t("settingsAiChatBaseUrl")}
    className={adminFieldClass}
    disabled={isLoadingAdminSettings || isSavingAiSettings}
    onChange={(event) => {
      setChatBaseUrl(event.target.value);
      schedulePersistAiSettings();
    }}
    type="text"
    value={chatBaseUrl}
  />
</label>
```

**Chat API Key** (around line 2064):
```tsx
<label className="block text-sm font-medium text-[#2D2926]">
  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
    {t("settingsAiChatApiKey")}
    {chatApiKeySource === "env" && !chatApiKey && <EnvConfiguredBadge />}
  </div>
  {chatApiKeySource === "env" && chatApiKey && (
    <p className="mt-1 text-xs text-amber-600">填写后将保存至数据库</p>
  )}
  <input
    aria-label={t("settingsAiChatApiKey")}
    className={adminFieldClass}
    disabled={isLoadingAdminSettings || isSavingAiSettings}
    onChange={(event) => {
      setChatApiKey(event.target.value);
      schedulePersistAiSettings();
    }}
    type="password"
    value={chatApiKey}
  />
</label>
```

**Chat Model** (around line 2079):
```tsx
<label className="mt-4 block text-sm font-medium text-[#2D2926]">
  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
    {t("settingsAiChatModel")}
    {chatModelSource === "env" && !chatModel && <EnvConfiguredBadge />}
  </div>
  {chatModelSource === "env" && chatModel && (
    <p className="mt-1 text-xs text-amber-600">填写后将保存至数据库</p>
  )}
  <input
    aria-label={t("settingsAiChatModel")}
    className={adminFieldClass}
    disabled={isLoadingAdminSettings || isSavingAiSettings}
    onChange={(event) => {
      setChatModel(event.target.value);
      schedulePersistAiSettings();
    }}
    type="text"
    value={chatModel}
  />
</label>
```

- [ ] **Step 5: Add badge + hint to STT API Key field**

The STT API Key field is inside `{sttProvider === "openai" && ...}` around line 2200. Apply the same pattern:

```tsx
<label className="block text-sm font-medium text-[#2D2926]">
  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
    {t("settingsAiTranscriptionApiKey")}
    {sttApiKeySource === "env" && !sttApiKey && <EnvConfiguredBadge />}
  </div>
  {sttApiKeySource === "env" && sttApiKey && (
    <p className="mt-1 text-xs text-amber-600">填写后将保存至数据库</p>
  )}
  <input
    aria-label={t("settingsAiTranscriptionApiKey")}
    className={adminFieldClass}
    disabled={isLoadingAdminSettings || isSavingAiSettings}
    onChange={(event) => {
      setSttApiKey(event.target.value);
      schedulePersistAiSettings();
    }}
    type="password"
    value={sttApiKey}
  />
</label>
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/SettingsSheet.tsx
git commit -m "feat(settings): show env-configured badge for API keys sourced from .env"
```

---

## Task 7: Frontend Tests — Update Fixture and Add Badge Tests

**Files:**
- Modify: `frontend/src/components/SettingsSheet.test.tsx`

- [ ] **Step 1: Update `defaultAdminSettings` fixture (line 129)**

```typescript
const defaultAdminSettings = {
  health_summary_refresh_time: "05:00",
  care_plan_refresh_time: "06:00",
  ai_default_language: "en" as const,
  transcription: {
    provider: "openai" as const,
    api_key: "stt-key",
    api_key_source: "db" as const,
    model: "gpt-4o-mini-transcribe",
    language: "zh",
    timeout: 30,
    local_whisper_model: "small",
    local_whisper_device: "auto",
    local_whisper_compute_type: "default",
    local_whisper_download_root: null,
  },
  chat_model: {
    base_url: "https://example.invalid/v1",
    base_url_source: "db" as const,
    api_key: "chat-key",
    api_key_source: "db" as const,
    model: "gpt-4.1-mini",
    model_source: "db" as const,
  },
};
```

- [ ] **Step 2: Add badge/hint test cases**

Find an existing `describe` block that tests the admin tab. Add these tests:

```typescript
it("shows env badge for chat api key when source is env and value is null", async () => {
  getAdminSettingsMock.mockResolvedValue({
    ...defaultAdminSettings,
    chat_model: {
      ...defaultAdminSettings.chat_model,
      api_key: null,
      api_key_source: "env",
    },
  });
  render(
    <PreferencesProvider>
      <SettingsSheet
        open={true}
        onClose={() => {}}
        members={members}
        session={adminSession}
        onMembersChange={() => {}}
      />
    </PreferencesProvider>,
  );
  const adminTab = screen.getByRole("tab", { name: /admin/i });
  fireEvent.click(adminTab);
  await waitFor(() => {
    expect(screen.getByText("来自环境变量")).toBeInTheDocument();
  });
});

it("shows save-to-db warning when user types into an env-configured api key field", async () => {
  getAdminSettingsMock.mockResolvedValue({
    ...defaultAdminSettings,
    chat_model: {
      ...defaultAdminSettings.chat_model,
      api_key: null,
      api_key_source: "env",
    },
  });
  render(
    <PreferencesProvider>
      <SettingsSheet
        open={true}
        onClose={() => {}}
        members={members}
        session={adminSession}
        onMembersChange={() => {}}
      />
    </PreferencesProvider>,
  );
  const adminTab = screen.getByRole("tab", { name: /admin/i });
  fireEvent.click(adminTab);
  const apiKeyInput = await screen.findByLabelText(/api key/i);
  fireEvent.change(apiKeyInput, { target: { value: "sk-override" } });
  expect(screen.getByText("填写后将保存至数据库")).toBeInTheDocument();
});
```

- [ ] **Step 3: Run frontend tests**

```bash
cd frontend
npm test -- --run src/components/SettingsSheet.test.tsx
```

Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/SettingsSheet.test.tsx
git commit -m "test(settings): update fixture and add env badge/hint tests"
```

---

## Task 8: Final Integration Check

- [ ] **Step 1: Run all backend tests**

```bash
cd backend
UV_CACHE_DIR=/tmp/kincare-uv-cache uv run --no-project --with-requirements requirements-dev.txt \
  pytest tests/ -v
```

Expected: all PASS

- [ ] **Step 2: Run all frontend tests**

```bash
cd frontend
npm test -- --run
```

Expected: all PASS

- [ ] **Step 3: Run TypeScript type check**

```bash
cd frontend
npm run build
```

Expected: no type errors

- [ ] **Step 4: Final commit if clean**

If all checks pass and no uncommitted changes remain:

```bash
git status
```

All clean. Done.
