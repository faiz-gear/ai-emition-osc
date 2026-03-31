# Provider Abstraction + LangChain 1.x Upgrade Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement encrypted, persistent provider management (`ollama`, `openai`, `openai_compatible`) and migrate emotion inference from direct `ChatOllama` usage to a provider-abstracted LangChain 1.x runtime.

**Architecture:** Add a dedicated `server/app/providers` domain with adapter, registry, crypto, repository, and service layers. Expose provider CRUD/activate/test APIs and wire provider status into app state and `/api/status`. Refactor `EmotionService` to request `BaseChatModel` from `ProviderService` and use structured output first, JSON fallback second.

**Tech Stack:** FastAPI, Pydantic v2, LangChain 1.x (`langchain-core`, `langchain-openai`, `langchain-ollama`), SQLite (`aiosqlite`), Next.js 14, TypeScript.

---

## Scope Check

This spec touches backend + frontend. They are coupled by one API contract and should ship together to avoid broken client/server combinations, so this remains one plan with chunk boundaries by subsystem.

## Execution Skills

- `@test-driven-development`
- `@verification-before-completion`
- `@requesting-code-review`

## File Structure (Target)

- Create `server/app/providers/__init__.py`: public exports for provider layer.
- Create `server/app/providers/base.py`: DTOs/protocols/enums for storage/runtime/service boundaries.
- Create `server/app/providers/errors.py`: provider-domain error codes and HTTP mapping helpers.
- Create `server/app/providers/crypto.py`: AES-256-GCM encrypt/decrypt helpers and envelope schema.
- Create `server/app/providers/storage.py`: SQLite repository + schema/version/init logic.
- Create `server/app/providers/registry.py`: provider type -> adapter routing.
- Create `server/app/providers/service.py`: validation, encryption, CRUD, activate lock, runtime model resolution.
- Create `server/app/providers/adapters/__init__.py`: adapter exports.
- Create `server/app/providers/adapters/ollama.py`: Ollama adapter.
- Create `server/app/providers/adapters/openai.py`: OpenAI adapter.
- Create `server/app/providers/adapters/openai_compatible.py`: OpenAI-compatible adapter.
- Create `server/app/api/providers.py`: provider REST endpoints.
- Create `server/scripts/rotate_provider_secrets.py`: key rotation utility with lock protocol.
- Modify `server/app/core/config.py`: add provider DB and secret config.
- Modify `server/app/main.py`: initialize provider storage/service and attach to app state.
- Modify `server/app/api/http.py`: include providers router and status behavior dependencies.
- Modify `server/app/models/events.py`: add `active_provider`/`active_model` in status config summary.
- Modify `server/app/services/hub.py`: include provider summary fields in status response.
- Modify `server/app/services/emotion_service.py`: switch to provider runtime + structured output fallback.
- Modify `server/requirements.txt`: upgrade LangChain + add `langchain-openai` and `aiosqlite`.
- Modify `requirements.txt`: keep root dependency list aligned with `server/requirements.txt`.
- Modify `.env.example`: add provider DB path and secret key variables.
- Modify `README.md`: document provider APIs, env vars, and migration notes.
- Create `tests/test_provider_crypto.py`: crypto unit tests.
- Create `tests/test_provider_storage.py`: schema/repository tests.
- Create `tests/test_provider_adapters.py`: adapter validation/model construction tests.
- Create `tests/test_provider_service.py`: service behavior tests.
- Create `tests/test_provider_api.py`: provider endpoint integration tests.
- Create `tests/test_emotion_service_provider.py`: emotion-service provider abstraction tests.
- Create `client/components/ProviderManager.tsx`: provider CRUD/activate/test UI.
- Modify `client/lib/types.ts`: provider DTO and error response types.
- Modify `client/app/page.tsx`: integrate provider manager and provider status rendering.
- Modify `client/package.json`: add any minimal client dependencies if needed for request helpers only.

## Chunk 1: Provider Foundation (Data, Crypto, Adapters)

### Task 1: Dependencies + Config Surface

**Files:**
- Modify: `server/requirements.txt`
- Modify: `requirements.txt`
- Modify: `server/app/core/config.py`
- Modify: `.env.example`
- Test: `tests/test_provider_config.py`

- [ ] **Step 1: Write the failing config test**

```python
# tests/test_provider_config.py
import os
import unittest

from server.app.core.config import load_config


class ProviderConfigTests(unittest.TestCase):
    def test_loads_provider_config_fields(self):
        os.environ["AI_EMOTION_PROVIDER_DB_PATH"] = "server/data/providers.db"
        os.environ["AI_EMOTION_PROVIDER_SECRET_KEY"] = "test-secret"
        cfg = load_config()
        self.assertEqual(cfg.provider_db_path, "server/data/providers.db")
        self.assertEqual(cfg.provider_secret_key, "test-secret")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest tests.test_provider_config.ProviderConfigTests.test_loads_provider_config_fields -v`  
Expected: FAIL with `AttributeError` for missing config fields.

- [ ] **Step 3: Implement config fields + dependency updates**

```python
# server/app/core/config.py (snippet)
provider_db_path: str
provider_secret_key: str
...
provider_db_path=_get_env_str("AI_EMOTION_PROVIDER_DB_PATH", "server/data/providers.db"),
provider_secret_key=_get_env_str("AI_EMOTION_PROVIDER_SECRET_KEY", ""),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest tests.test_provider_config.ProviderConfigTests.test_loads_provider_config_fields -v`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/requirements.txt requirements.txt server/app/core/config.py .env.example tests/test_provider_config.py
git commit -m "feat: add provider config and langchain 1.x dependency baseline"
```

### Task 2: Encryption Module

**Files:**
- Create: `server/app/providers/crypto.py`
- Create: `tests/test_provider_crypto.py`

- [ ] **Step 1: Write failing crypto roundtrip test**

```python
async def test_encrypt_decrypt_roundtrip(self):
    from server.app.providers.crypto import ProviderCrypto
    crypto = ProviderCrypto("0123456789abcdef0123456789abcdef")
    ciphertext = crypto.encrypt_json({"Authorization": "Bearer x"})
    plaintext = crypto.decrypt_json(ciphertext)
    self.assertEqual(plaintext["Authorization"], "Bearer x")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest tests.test_provider_crypto -v`  
Expected: FAIL with `ModuleNotFoundError` (`server.app.providers`).

- [ ] **Step 3: Implement minimal crypto module**

```python
class ProviderCrypto:
    def encrypt_json(self, value: dict[str, str]) -> str: ...
    def decrypt_json(self, payload: str) -> dict[str, str]: ...
    def encrypt_text(self, value: str) -> str: ...
    def decrypt_text(self, payload: str) -> str: ...
```

- [ ] **Step 4: Add negative-path tests**

```python
def test_decrypt_with_wrong_key_raises(self): ...
def test_decrypt_malformed_payload_raises(self): ...
```

- [ ] **Step 5: Run tests**

Run: `python -m unittest tests.test_provider_crypto -v`  
Expected: PASS (all crypto tests green).

- [ ] **Step 6: Commit**

```bash
git add server/app/providers/crypto.py tests/test_provider_crypto.py
git commit -m "feat: add provider secret encryption with aes-gcm envelopes"
```

### Task 3: SQLite Repository + Schema Init

**Files:**
- Create: `server/app/providers/base.py`
- Create: `server/app/providers/storage.py`
- Create: `tests/test_provider_storage.py`

- [ ] **Step 1: Write failing storage init test**

```python
async def test_initialize_creates_schema_and_default_active(self):
    repo = SqliteProviderRepository(db_path=self.db_path)
    await repo.initialize(default_model="qwen2.5:3b")
    active = await repo.get_active()
    self.assertIsNotNone(active)
    self.assertEqual(active.provider_type, "ollama")
```

- [ ] **Step 2: Run test to verify failure**

Run: `python -m unittest tests.test_provider_storage -v`  
Expected: FAIL with missing repository implementation.

- [ ] **Step 3: Implement schema/version/init and repository CRUD**

```python
class SqliteProviderRepository:
    async def initialize(self, default_model: str) -> None: ...
    async def list(self) -> list[StoredProviderRecord]: ...
    async def create(self, input: StoredProviderWrite) -> StoredProviderRecord: ...
    async def set_active(self, provider_id: str) -> StoredProviderRecord: ...
```

- [ ] **Step 4: Add tests for unique constraints and one-active invariant**

```python
async def test_name_must_be_unique(self): ...
async def test_only_one_active_provider(self): ...
```

- [ ] **Step 5: Run storage test suite**

Run: `python -m unittest tests.test_provider_storage -v`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/app/providers/base.py server/app/providers/storage.py tests/test_provider_storage.py
git commit -m "feat: add sqlite provider repository with schema versioning"
```

### Task 4: Adapters + Registry

**Files:**
- Create: `server/app/providers/adapters/ollama.py`
- Create: `server/app/providers/adapters/openai.py`
- Create: `server/app/providers/adapters/openai_compatible.py`
- Create: `server/app/providers/adapters/__init__.py`
- Create: `server/app/providers/registry.py`
- Create: `tests/test_provider_adapters.py`

- [ ] **Step 1: Write failing adapter validation tests**

```python
def test_openai_requires_api_key(self):
    adapter = OpenAIAdapter()
    with self.assertRaises(ValueError):
        adapter.validate(runtime_config_without_key)
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `python -m unittest tests.test_provider_adapters -v`  
Expected: FAIL with missing adapter modules.

- [ ] **Step 3: Implement adapters and registry dispatch**

```python
class ProviderRegistry:
    def get(self, provider_type: str) -> ProviderAdapter:
        return self._adapters[provider_type]
```

- [ ] **Step 4: Add create_model smoke assertions**

```python
def test_ollama_adapter_builds_chat_model(self): ...
def test_openai_compatible_uses_custom_base_url(self): ...
```

- [ ] **Step 5: Run adapter tests**

Run: `python -m unittest tests.test_provider_adapters -v`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/app/providers/adapters server/app/providers/registry.py tests/test_provider_adapters.py
git commit -m "feat: add provider adapters and registry routing"
```

### Chunk 1 Review Gate

- [ ] Run plan-document-reviewer on Chunk 1 with spec: `docs/superpowers/specs/2026-03-18-provider-abstraction-langchain-upgrade-design.md`
- [ ] Resolve review findings and re-run reviewer until approved.

## Chunk 2: Provider Service + HTTP API

### Task 5: Provider Service Domain Logic

**Files:**
- Create: `server/app/providers/errors.py`
- Create: `server/app/providers/service.py`
- Modify: `server/app/providers/__init__.py`
- Test: `tests/test_provider_service.py`

- [ ] **Step 1: Write failing service behavior tests**

```python
async def test_provider_type_is_immutable_on_patch(self):
    service = build_service()
    created = await service.create_provider(valid_ollama_input())
    with self.assertRaises(ProviderTypeImmutableError):
        await service.update_provider(created.id, {"provider_type": "openai"})
```

- [ ] **Step 2: Run service tests and confirm failure**

Run: `python -m unittest tests.test_provider_service -v`  
Expected: FAIL with missing `ProviderService`.

- [ ] **Step 3: Implement service methods with encryption + lock**

```python
class ProviderService:
    def __init__(...):
        self._activate_lock = asyncio.Lock()
    async def create_provider(self, input: CreateProviderInput) -> ProviderSummary: ...
    async def update_provider(self, provider_id: str, patch: UpdateProviderInput) -> ProviderSummary: ...
    async def activate_provider(self, provider_id: str) -> ProviderSummary: ...
    async def get_active_chat_model(self) -> BaseChatModel: ...
```

- [ ] **Step 4: Add degraded-list behavior tests for decrypt failure**

```python
async def test_list_summaries_marks_degraded_on_secret_decrypt_error(self): ...
```

- [ ] **Step 5: Run service tests**

Run: `python -m unittest tests.test_provider_service -v`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/app/providers/__init__.py server/app/providers/errors.py server/app/providers/service.py tests/test_provider_service.py
git commit -m "feat: add provider service with validation encryption and activation semantics"
```

### Task 6: Provider API Endpoints + Error Mapping

**Files:**
- Create: `server/app/api/providers.py`
- Modify: `server/app/api/http.py`
- Test: `tests/test_provider_api.py`

- [ ] **Step 1: Write failing API contract tests**

```python
async def test_post_provider_returns_201(self):
    response = client.post("/api/providers", json=payload)
    self.assertEqual(response.status_code, 201)
```

- [ ] **Step 2: Run tests to verify failure**

Run: `python -m unittest tests.test_provider_api -v`  
Expected: FAIL with `404` because router is not mounted.

- [ ] **Step 3: Implement routes and stable error response body**

```python
@router.post("/api/providers", response_model=ProviderSummary, status_code=201)
async def create_provider(...): ...
```

- [ ] **Step 4: Add tests for `activate`, `test`, `delete active`, and error codes**

```python
def test_activate_missing_returns_provider_not_found(self): ...
def test_delete_active_allows_no_active_state(self): ...
```

- [ ] **Step 5: Run API tests**

Run: `python -m unittest tests.test_provider_api -v`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/app/api/providers.py server/app/api/http.py tests/test_provider_api.py
git commit -m "feat: add provider management http endpoints"
```

### Task 7: Status Surface Integration

**Files:**
- Modify: `server/app/models/events.py`
- Modify: `server/app/services/hub.py`
- Modify: `tests/test_hub_dropped.py`

- [ ] **Step 1: Write failing status contract assertions**

```python
status = await hub.get_status_response()
self.assertIsNone(status.config.active_provider)
self.assertIsNone(status.config.active_model)
```

- [ ] **Step 2: Run test and confirm failure**

Run: `python -m unittest tests.test_hub_dropped.HubDroppedTests -v`  
Expected: FAIL because new fields are absent.

- [ ] **Step 3: Implement config summary extensions**

```python
class ConfigSummary(BaseModel):
    ...
    active_provider: str | None = None
    active_model: str | None = None
```

- [ ] **Step 4: Wire hub to read provider service active summary**

```python
active_provider = await self._provider_status_reader()
```

- [ ] **Step 5: Run hub tests**

Run: `python -m unittest tests.test_hub_dropped -v`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/app/models/events.py server/app/services/hub.py tests/test_hub_dropped.py
git commit -m "feat: expose active provider metadata in status responses"
```

### Chunk 2 Review Gate

- [ ] Run plan-document-reviewer on Chunk 2 with spec: `docs/superpowers/specs/2026-03-18-provider-abstraction-langchain-upgrade-design.md`
- [ ] Resolve review findings and re-run reviewer until approved.

## Chunk 3: Runtime Migration (Emotion + Rotation)

### Task 8: Refactor EmotionService to Provider Abstraction

**Files:**
- Modify: `server/app/services/emotion_service.py`
- Modify: `server/app/main.py`
- Create: `tests/test_emotion_service_provider.py`

- [ ] **Step 1: Write failing emotion-service provider tests**

```python
async def test_analyze_uses_provider_service_model(self):
    provider_service = FakeProviderService(model=FakeChatModel(...))
    service = EmotionService(provider_service=provider_service, prompt_template="...")
    result = await service.analyze_text("hello")
    self.assertEqual(result.dominant_emotion, "joy")
```

- [ ] **Step 2: Run tests and verify failure**

Run: `python -m unittest tests.test_emotion_service_provider -v`  
Expected: FAIL because `EmotionService` still depends on `ChatOllama`.

- [ ] **Step 3: Implement structured-output-first pipeline**

```python
structured_model = model.with_structured_output(EmotionResultSchema)
try:
    return await structured_model.ainvoke(prompt)
except Exception:
    # fallback to JSON extraction
```

- [ ] **Step 4: Add fallback-path test for malformed model output**

```python
async def test_falls_back_to_json_extraction_when_structured_output_fails(self): ...
```

- [ ] **Step 5: Run emotion-service tests**

Run: `python -m unittest tests.test_emotion_service_provider -v`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/app/services/emotion_service.py server/app/main.py tests/test_emotion_service_provider.py
git commit -m "refactor: migrate emotion service to provider-based langchain runtime"
```

### Task 9: Rotation Lock + Secret Rotation Script

**Files:**
- Create: `server/scripts/rotate_provider_secrets.py`
- Modify: `server/app/providers/service.py`
- Modify: `tests/test_provider_service.py`

- [ ] **Step 1: Write failing rotation lock tests**

```python
async def test_mutating_operations_block_when_rotation_lock_enabled(self):
    await repo.set_rotation_lock(True)
    with self.assertRaises(ProviderRotationInProgressError):
        await service.create_provider(valid_openai_input())
```

- [ ] **Step 2: Run tests to verify failure**

Run: `python -m unittest tests.test_provider_service.ProviderServiceTests.test_mutating_operations_block_when_rotation_lock_enabled -v`  
Expected: FAIL (lock check missing).

- [ ] **Step 3: Implement service lock guard + script contract**

```python
if await self._repo.is_rotation_locked():
    raise ProviderRotationInProgressError()
```

- [ ] **Step 4: Add script dry-run test (argument validation)**

```bash
python server/scripts/rotate_provider_secrets.py --help
```
Expected: usage output includes `--db-path`, `--old-key-env`, `--new-key-env`.

- [ ] **Step 5: Run targeted tests**

Run: `python -m unittest tests.test_provider_service -v`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/scripts/rotate_provider_secrets.py server/app/providers/service.py tests/test_provider_service.py
git commit -m "feat: add provider secret rotation lock and key rotation script"
```

### Task 10: Backend Integration/Regression Sweep

**Files:**
- Modify: `tests/test_provider_api.py`
- Modify: `tests/test_emotion_queue.py`
- Modify: `tests/test_hub_dropped.py`

- [ ] **Step 1: Add failing end-to-end provider workflow test**

```python
def test_create_activate_status_and_delete_provider_flow(self): ...
```

- [ ] **Step 2: Run full backend tests and capture failures**

Run: `python -m unittest discover -s tests -p 'test_*.py' -v`  
Expected: FAIL with remaining contract gaps.

- [ ] **Step 3: Fix remaining backend mismatches**

```python
# patch API/service wiring and error mapping based on failing assertions
```

- [ ] **Step 4: Re-run full backend tests**

Run: `python -m unittest discover -s tests -p 'test_*.py' -v`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/test_provider_api.py tests/test_emotion_queue.py tests/test_hub_dropped.py
git commit -m "test: add provider workflow regression coverage"
```

### Chunk 3 Review Gate

- [ ] Run plan-document-reviewer on Chunk 3 with spec: `docs/superpowers/specs/2026-03-18-provider-abstraction-langchain-upgrade-design.md`
- [ ] Resolve review findings and re-run reviewer until approved.

## Chunk 4: Frontend Provider UI + Documentation + Final Verification

### Task 11: Frontend Provider Types + Manager UI

**Files:**
- Modify: `client/lib/types.ts`
- Create: `client/components/ProviderManager.tsx`
- Modify: `client/app/page.tsx`

- [ ] **Step 1: Add failing compile-time integration point**

```tsx
// client/app/page.tsx
<ProviderManager activeProviderId={state.status?.config.active_provider ?? null} />
```

- [ ] **Step 2: Run typecheck/lint to confirm failure**

Run: `cd client && npm run lint`  
Expected: FAIL because `ProviderManager`/provider types are missing.

- [ ] **Step 3: Implement provider DTOs + manager component**

```ts
export type ProviderSummary = {
  id: string;
  name: string;
  provider_type: "ollama" | "openai" | "openai_compatible";
  ...
};
```

- [ ] **Step 4: Implement CRUD + activate + test UI actions**

```tsx
const createProvider = async (payload: CreateProviderRequest) => { ... };
const activateProvider = async (id: string) => { ... };
```

- [ ] **Step 5: Re-run lint/build verification**

Run: `cd client && npm run lint && npm run build`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/lib/types.ts client/components/ProviderManager.tsx client/app/page.tsx
git commit -m "feat: add provider management ui to dashboard"
```

### Task 12: Docs + Final Verification

**Files:**
- Modify: `README.md`
- Modify: `.env.example`
- Modify: `docs/superpowers/specs/2026-03-18-provider-abstraction-langchain-upgrade-design.md` (optional status notes only)

- [ ] **Step 1: Add failing docs checklist item**

```markdown
- [ ] Provider env vars documented in README and .env.example
```

- [ ] **Step 2: Update docs for provider setup and migration**

```markdown
AI_EMOTION_PROVIDER_SECRET_KEY=<32-byte-secret>
AI_EMOTION_PROVIDER_DB_PATH=server/data/providers.db
```

- [ ] **Step 3: Run backend + frontend verification commands**

Run: `python -m unittest discover -s tests -p 'test_*.py' -v`  
Expected: PASS.

Run: `cd client && npm run lint && npm run build`  
Expected: PASS.

- [ ] **Step 4: Commit docs + verification snapshot**

```bash
git add README.md .env.example
git commit -m "docs: document provider configuration and operational workflows"
```

- [ ] **Step 5: Final review + handoff commit log**

Run: `git log --oneline -n 8`  
Expected: clear, task-aligned commits for each plan section.

### Chunk 4 Review Gate

- [ ] Run plan-document-reviewer on Chunk 4 with spec: `docs/superpowers/specs/2026-03-18-provider-abstraction-langchain-upgrade-design.md`
- [ ] Resolve review findings and re-run reviewer until approved.

## Global Verification Checklist

- [ ] `AI_EMOTION_PROVIDER_SECRET_KEY` missing at startup causes fail-fast with clear message.
- [ ] Empty DB creates one default active `ollama` provider using `AI_EMOTION_LLM_MODEL`.
- [ ] Provider list degrades corrupted-secret records without exposing secrets.
- [ ] Active provider decrypt failure returns `500 PROVIDER_SECRET_DECRYPT_FAILED`.
- [ ] Delete active provider leaves system running with no active provider.
- [ ] Worker emits error status when analyze runs without active provider.
- [ ] `/api/status` includes `active_provider` and `active_model`.
- [ ] No plaintext `api_key`/`headers` stored in SQLite.

## Suggested Execution Order

1. Chunk 1
2. Chunk 2
3. Chunk 3
4. Chunk 4

