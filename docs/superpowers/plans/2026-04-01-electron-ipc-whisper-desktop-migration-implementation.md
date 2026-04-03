# Electron IPC + Whisper Desktop Migration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Python/Vosk runtime with an Electron desktop app that uses typed IPC, local Whisper models, and a desktop-native settings experience for ASR model management and language strategy.

**Architecture:** Build a root workspace with three packages: `desktop` for Electron main/preload/runtime workers, `packages/contracts` for shared IPC/domain contracts, and the existing `client` for the Next.js renderer. Use `electron-vite` for Electron build orchestration, export the Next.js app as static assets for production, run Whisper inference in a dedicated ASR runtime path, and route all renderer operations through a typed preload client instead of HTTP/WebSocket.

**Tech Stack:** Electron, electron-vite, Next.js 14 static export, TypeScript, Vitest, React Testing Library, LangChain TypeScript, `@huggingface/transformers`, `onnxruntime-node`, SQLite, `node-osc`.

---

## Scope Check

This plan covers one coherent subsystem: desktop runtime migration for the product path. GitHub Actions packaging, release automation, signing, and installer policy are intentionally excluded and belong in a separate plan.

## Execution Skills

- `@test-driven-development`
- `@verification-before-completion`
- `@requesting-code-review`
- `@systematic-debugging`

## File Structure (Target)

- Create: `package.json` (root workspace scripts and shared dev dependencies)
- Create: `tsconfig.base.json` (shared compiler defaults)
- Create: `desktop/package.json`
- Create: `desktop/electron.vite.config.ts`
- Create: `desktop/tsconfig.json`
- Create: `desktop/vitest.config.ts`
- Create: `desktop/src/main/index.ts` (Electron app bootstrap)
- Create: `desktop/src/main/windows/create-main-window.ts`
- Create: `desktop/src/main/windows/create-capture-window.ts`
- Create: `desktop/src/main/ipc/register-ipc.ts`
- Create: `desktop/src/main/ipc/runtime-bus.ts`
- Create: `desktop/src/main/ipc/validators.ts`
- Create: `desktop/src/preload/index.ts`
- Create: `desktop/src/preload/desktop-api.ts`
- Create: `desktop/src/runtime/config/app-config-store.ts`
- Create: `desktop/src/runtime/providers/provider-repository.ts`
- Create: `desktop/src/runtime/providers/provider-crypto.ts`
- Create: `desktop/src/runtime/providers/provider-service.ts`
- Create: `desktop/src/runtime/providers/adapters/ollama.ts`
- Create: `desktop/src/runtime/providers/adapters/openai.ts`
- Create: `desktop/src/runtime/providers/adapters/openai-compatible.ts`
- Create: `desktop/src/runtime/emotion/emotion-worker.ts`
- Create: `desktop/src/runtime/emotion/emotion-service.ts`
- Create: `desktop/src/runtime/emotion/emotion-queue.ts`
- Create: `desktop/src/runtime/osc/osc-service.ts`
- Create: `desktop/src/runtime/asr/model-catalog.ts`
- Create: `desktop/src/runtime/asr/model-store.ts`
- Create: `desktop/src/runtime/asr/download-manager.ts`
- Create: `desktop/src/runtime/asr/asr-session-service.ts`
- Create: `desktop/src/runtime/asr/whisper-runner.ts`
- Create: `desktop/src/runtime/asr/asr-worker.ts`
- Create: `desktop/src/capture/index.html`
- Create: `desktop/src/capture/index.ts`
- Create: `desktop/src/capture/audio-worklet-bridge.ts`
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/domain.ts`
- Create: `packages/contracts/src/ipc.ts`
- Create: `packages/contracts/src/asr.ts`
- Create: `packages/contracts/src/providers.ts`
- Create: `packages/contracts/src/errors.ts`
- Create: `packages/contracts/src/__tests__/ipc.test.ts`
- Create: `desktop/src/__tests__/main/bootstrap.test.ts`
- Create: `desktop/src/__tests__/ipc/register-ipc.test.ts`
- Create: `desktop/src/__tests__/runtime/config/app-config-store.test.ts`
- Create: `desktop/src/__tests__/runtime/providers/provider-service.test.ts`
- Create: `desktop/src/__tests__/runtime/asr/model-catalog.test.ts`
- Create: `desktop/src/__tests__/runtime/asr/download-manager.test.ts`
- Create: `desktop/src/__tests__/runtime/asr/asr-session-service.test.ts`
- Create: `desktop/src/__tests__/runtime/emotion/emotion-service.test.ts`
- Create: `client/lib/desktop/desktop-client.ts`
- Create: `client/lib/desktop/desktop-events.ts`
- Create: `client/lib/desktop/__tests__/desktop-client.test.ts`
- Create: `client/components/settings/SettingsAsrModelSection.tsx`
- Create: `client/components/settings/SettingsRecognitionStrategySection.tsx`
- Create: `client/components/settings/__tests__/SettingsAsrModelSection.test.tsx`
- Create: `client/components/settings/__tests__/SettingsRecognitionStrategySection.test.tsx`
- Modify: `client/next.config.mjs` (static export for desktop production)
- Modify: `client/lib/types.ts` (shared domain alignment with desktop events)
- Modify: `client/lib/i18n.tsx` (desktop strings, ASR strings, remove endpoint language from desktop path)
- Modify: `client/components/settings/SettingsPage.tsx`
- Modify: `client/components/settings/SettingsProviderSection.tsx`
- Modify: `client/app/page.tsx`
- Modify: `client/components/dashboard/DashboardShell.tsx`
- Modify: `client/components/dashboard/LiveTranscriptStage.tsx`
- Modify: `client/components/dashboard/UtteranceStreamPanel.tsx`
- Modify: `client/components/dashboard/__tests__/LiveTranscriptStage.test.tsx`
- Modify: `client/components/settings/__tests__/SettingsPage.test.tsx`
- Modify: `README.md`
- Optional final cleanup after parity: deprecate `server/`, `main.py`, `speech_recognizer.py`, `voice_processor.py`, `start.bat`, `dev.bat`

## Chunk 1: Workspace Bootstrap and Shared Contracts

### Task 1: Preflight and Baseline Verification

**Files:**
- Modify: none
- Test: existing `client` and Python/server checks

- [ ] **Step 1: Verify isolated workspace assumptions**

Run:
```bash
git worktree list
git status --short
```
Expected: you understand whether work is happening in a dedicated worktree; any unrelated dirty files are documented before changes begin.

- [ ] **Step 2: Capture current baseline**

Run:
```bash
cd client
npm install
npm run lint
npm run test:unit
npm run build
cd ..
python -m pytest tests -q
```
Expected: all current checks PASS, or any pre-existing failures are recorded before desktop work starts.

- [ ] **Step 3: Record baseline in implementation notes if needed**

If there are unexpected pre-existing failures, add a short note to the active task tracker or the first implementation commit message. Do not start coding around unexplained baseline breakage.

### Task 2: Create Root Workspace and Contracts Package

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/domain.ts`
- Create: `packages/contracts/src/ipc.ts`
- Create: `packages/contracts/src/asr.ts`
- Create: `packages/contracts/src/providers.ts`
- Create: `packages/contracts/src/errors.ts`
- Create: `packages/contracts/src/__tests__/ipc.test.ts`

- [ ] **Step 1: Write failing shared-contract tests**

Create `packages/contracts/src/__tests__/ipc.test.ts` to assert:
- `desktopApi` command names are stable string literals
- runtime event payloads are discriminated unions
- ASR settings contract supports `auto` and fixed `zh` / `en`
- provider error codes and ASR error codes are exported from one place

Use a contract shape like:

```ts
import { expect, test } from "vitest";
import { DesktopCommand, RuntimeEvent, isFixedLanguage } from "../index";

test("desktop commands remain stable", () => {
  expect(DesktopCommand.StartListening).toBe("session:start-listening");
});

test("fixed language guard accepts only zh and en", () => {
  expect(isFixedLanguage("zh")).toBe(true);
  expect(isFixedLanguage("en")).toBe(true);
  expect(isFixedLanguage("ja")).toBe(false);
});
```

- [ ] **Step 2: Add root workspace manifests**

Create root `package.json` with workspaces:
- `client`
- `desktop`
- `packages/contracts`

Add root scripts:
- `build`
- `test`
- `lint`
- `desktop:dev`
- `desktop:build`
- `client:build`

Create `tsconfig.base.json` with strict TypeScript defaults shared by `desktop` and `packages/contracts`.

- [ ] **Step 3: Run shared-contract test to verify failure**

Run:
```bash
npm install
npm run test --workspace @ai-emotion/contracts
```
Expected: FAIL because contract exports are missing.

- [ ] **Step 4: Implement contracts package**

In `packages/contracts/src/ipc.ts`, export stable command and event identifiers such as:

```ts
export const DesktopCommand = {
  StartListening: "session:start-listening",
  StopListening: "session:stop-listening",
  DownloadAsrModel: "asr:download-model",
  ActivateAsrModel: "asr:activate-model",
  UpdateRecognitionStrategy: "asr:update-recognition-strategy",
  ListProviders: "providers:list",
} as const;
```

In `packages/contracts/src/domain.ts`, keep domain shapes aligned with current client concepts:
- `Utterance`
- `EmotionResult`
- `Metrics`
- `ProviderSummary`

In `packages/contracts/src/asr.ts`, define:
- `AsrModelCatalogItem`
- `InstalledAsrModel`
- `RecognitionStrategy`
- `DownloadProgressEvent`

In `packages/contracts/src/errors.ts`, export stable desktop error code unions and helper guards.

- [ ] **Step 5: Re-run shared-contract test**

Run:
```bash
npm run test --workspace @ai-emotion/contracts
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.base.json packages/contracts
git commit -m "feat(contracts): add shared desktop ipc and domain contracts"
```

### Task 3: Scaffold Desktop Package and Static Renderer Build Path

**Files:**
- Create: `desktop/package.json`
- Create: `desktop/electron.vite.config.ts`
- Create: `desktop/tsconfig.json`
- Create: `desktop/vitest.config.ts`
- Create: `desktop/src/main/index.ts`
- Create: `desktop/src/main/windows/create-main-window.ts`
- Create: `desktop/src/preload/index.ts`
- Create: `desktop/src/__tests__/main/bootstrap.test.ts`
- Modify: `client/next.config.mjs`

- [ ] **Step 1: Write failing desktop bootstrap test**

Create `desktop/src/__tests__/main/bootstrap.test.ts` to assert:
- main process bootstrap delegates BrowserWindow creation to `createMainWindow`
- preload path is configured
- production path resolution loads exported client assets instead of an HTTP URL by default

Example:

```ts
import { describe, expect, test, vi } from "vitest";
import { resolveRendererEntry } from "../../main/index";

test("production renderer entry targets exported client html", () => {
  expect(resolveRendererEntry(false)).toMatch(/client-dist\/index\.html$/);
});
```

- [ ] **Step 2: Add package manifests and config**

Create `desktop/package.json` with scripts:
- `dev`
- `build`
- `test`

Add dependencies for:
- `electron`
- `electron-vite`
- `vitest`
- `@ai-emotion/contracts`

Create `desktop/tsconfig.json` extending `../tsconfig.base.json`.

- [ ] **Step 3: Run desktop bootstrap test to verify failure**

Run:
```bash
npm run test --workspace @ai-emotion/desktop -- bootstrap.test.ts
```
Expected: FAIL because desktop bootstrap implementation does not exist yet.

- [ ] **Step 4: Implement minimal desktop shell**

Create `desktop/src/main/index.ts` and `desktop/src/main/windows/create-main-window.ts` with:
- app ready bootstrap
- BrowserWindow creation with `contextIsolation: true`
- preload registration
- `resolveRendererEntry(isDev: boolean)` helper

Update `client/next.config.mjs` to enable static export for production:

```js
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  images: { unoptimized: true },
};
```

- [ ] **Step 5: Re-run desktop bootstrap test**

Run:
```bash
npm run test --workspace @ai-emotion/desktop -- bootstrap.test.ts
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add desktop client/next.config.mjs
git commit -m "feat(desktop): scaffold electron shell and static renderer build path"
```

## Chunk 2: Typed IPC and Desktop Persistence

### Task 4: Add Typed Preload API and Main-Process IPC Registration

**Files:**
- Create: `desktop/src/main/ipc/register-ipc.ts`
- Create: `desktop/src/main/ipc/runtime-bus.ts`
- Create: `desktop/src/main/ipc/validators.ts`
- Create: `desktop/src/preload/desktop-api.ts`
- Modify: `desktop/src/preload/index.ts`
- Create: `desktop/src/__tests__/ipc/register-ipc.test.ts`

- [ ] **Step 1: Write failing IPC registration test**

Create `desktop/src/__tests__/ipc/register-ipc.test.ts` asserting:
- every renderer command defined in `@ai-emotion/contracts` is registered once
- main-process validation rejects malformed payloads
- event subscription returns an unsubscribe function

Example:

```ts
test("update recognition strategy rejects unsupported fixed language", async () => {
  await expect(
    invokeValidated("asr:update-recognition-strategy", { mode: "fixed", fixedLanguage: "ja" })
  ).rejects.toThrow(/invalid/i);
});
```

- [ ] **Step 2: Run focused IPC test to verify failure**

Run:
```bash
npm run test --workspace @ai-emotion/desktop -- register-ipc.test.ts
```
Expected: FAIL because registration and validators are missing.

- [ ] **Step 3: Implement typed IPC surface**

In `desktop/src/main/ipc/register-ipc.ts`, register commands for:
- session start/stop
- runtime snapshot
- ASR model list/download/activate/delete
- recognition strategy get/update
- provider CRUD/test/activate

In `desktop/src/preload/desktop-api.ts`, expose a single `desktopApi` object:

```ts
export type DesktopApi = {
  session: {
    startListening(): Promise<void>;
    stopListening(): Promise<void>;
    getSnapshot(): Promise<RuntimeSnapshot>;
    subscribe(listener: (event: RuntimeEvent) => void): () => void;
  };
  asr: {
    listCatalog(): Promise<AsrModelCatalogItem[]>;
    listInstalled(): Promise<InstalledAsrModel[]>;
    downloadModel(modelId: string): Promise<void>;
    activateModel(modelId: string): Promise<void>;
    updateRecognitionStrategy(input: RecognitionStrategy): Promise<RecognitionStrategy>;
  };
  providers: { /* typed CRUD methods */ };
};
```

Ensure the main process re-validates every invoke payload before touching state or filesystem.

- [ ] **Step 4: Re-run focused IPC test**

Run:
```bash
npm run test --workspace @ai-emotion/desktop -- register-ipc.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/main/ipc desktop/src/preload desktop/src/__tests__/ipc/register-ipc.test.ts
git commit -m "feat(desktop): add typed preload api and validated ipc registration"
```

### Task 5: Implement Desktop Config Store

**Files:**
- Create: `desktop/src/runtime/config/app-config-store.ts`
- Create: `desktop/src/__tests__/runtime/config/app-config-store.test.ts`

- [ ] **Step 1: Write failing config-store tests**

Create `desktop/src/__tests__/runtime/config/app-config-store.test.ts` covering:
- app data paths resolve outside the packaged app
- first-run defaults contain no installed ASR models
- recognition strategy defaults to `auto`
- switching strategy while listening is flagged by service-level guard, not by silent mutation

- [ ] **Step 2: Run config-store test to verify failure**

Run:
```bash
npm run test --workspace @ai-emotion/desktop -- app-config-store.test.ts
```
Expected: FAIL because store is missing.

- [ ] **Step 3: Implement app config store**

`desktop/src/runtime/config/app-config-store.ts` should:
- resolve app-data roots with Electron path helpers
- persist JSON config for ASR/runtime preferences
- keep provider DB path and model root path in one place
- expose explicit read/update methods instead of free-form object mutation

Use a shape like:

```ts
type AppConfig = {
  asr: {
    currentModelId: string | null;
    languageMode: "auto" | "fixed";
    fixedLanguage: "zh" | "en" | null;
    installedModels: InstalledAsrModel[];
  };
  osc: { host: string; port: number };
};
```

- [ ] **Step 4: Re-run config-store test**

Run:
```bash
npm run test --workspace @ai-emotion/desktop -- app-config-store.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/runtime/config desktop/src/__tests__/runtime/config/app-config-store.test.ts
git commit -m "feat(desktop): add app data config store for asr and runtime settings"
```

### Task 6: Migrate Provider Persistence and Emotion Runtime

**Files:**
- Create: `desktop/src/runtime/providers/provider-repository.ts`
- Create: `desktop/src/runtime/providers/provider-crypto.ts`
- Create: `desktop/src/runtime/providers/provider-service.ts`
- Create: `desktop/src/runtime/providers/adapters/ollama.ts`
- Create: `desktop/src/runtime/providers/adapters/openai.ts`
- Create: `desktop/src/runtime/providers/adapters/openai-compatible.ts`
- Create: `desktop/src/runtime/emotion/emotion-service.ts`
- Create: `desktop/src/runtime/emotion/emotion-queue.ts`
- Create: `desktop/src/runtime/emotion/emotion-worker.ts`
- Create: `desktop/src/runtime/osc/osc-service.ts`
- Create: `desktop/src/__tests__/runtime/providers/provider-service.test.ts`
- Create: `desktop/src/__tests__/runtime/emotion/emotion-service.test.ts`

- [ ] **Step 1: Write failing provider and emotion tests**

Add tests for:
- provider CRUD and activation in SQLite
- encrypted secret persistence
- provider test behavior mapping auth/rate-limit/unavailable failures to stable codes
- emotion service preferring structured output and falling back to JSON extraction
- OSC service swallowing transport exceptions without crashing the runtime

- [ ] **Step 2: Run focused tests to verify failure**

Run:
```bash
npm run test --workspace @ai-emotion/desktop -- provider-service.test.ts emotion-service.test.ts
```
Expected: FAIL because provider and emotion runtime implementations are missing.

- [ ] **Step 3: Implement provider repository and service**

Use SQLite under app data, preserving current conceptual schema:
- provider configs
- one active provider
- encrypted secret fields at rest

Port current behavior from `server/app/providers/*` into TypeScript with smaller units:
- repository: SQL and row mapping only
- crypto: encrypt/decrypt only
- service: validation, activation, runtime model creation

- [ ] **Step 4: Implement LangChain emotion runtime and OSC**

Port current prompt/interpolation and JSON normalization logic from:
- `server/app/services/emotion_service.py`
- `server/app/services/emotion_queue.py`
- `server/app/services/osc_service.py`

Use `node-osc` for OSC output.

- [ ] **Step 5: Re-run focused tests**

Run:
```bash
npm run test --workspace @ai-emotion/desktop -- provider-service.test.ts emotion-service.test.ts
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add desktop/src/runtime/providers desktop/src/runtime/emotion desktop/src/runtime/osc desktop/src/__tests__/runtime/providers/provider-service.test.ts desktop/src/__tests__/runtime/emotion/emotion-service.test.ts
git commit -m "feat(desktop): migrate provider persistence and emotion runtime to typescript"
```

## Chunk 3: Whisper ASR Runtime and Model Management

### Task 7: Implement ASR Model Catalog and Download Manager

**Files:**
- Create: `desktop/src/runtime/asr/model-catalog.ts`
- Create: `desktop/src/runtime/asr/model-store.ts`
- Create: `desktop/src/runtime/asr/download-manager.ts`
- Create: `desktop/src/__tests__/runtime/asr/model-catalog.test.ts`
- Create: `desktop/src/__tests__/runtime/asr/download-manager.test.ts`

- [ ] **Step 1: Write failing model-management tests**

Create tests asserting:
- catalog only exposes the predefined models selected for phase one
- model metadata includes size, source URL, checksum, and multilingual note
- download manager emits `queued`, `downloading`, `verifying`, `ready`, `failed`
- deleting the active model is blocked with a stable error code

- [ ] **Step 2: Run focused ASR model tests to verify failure**

Run:
```bash
npm run test --workspace @ai-emotion/desktop -- model-catalog.test.ts download-manager.test.ts
```
Expected: FAIL because ASR model management files are missing.

- [ ] **Step 3: Implement model catalog and model store**

In `model-catalog.ts`, define a small curated catalog, for example:

```ts
export const ASR_MODEL_CATALOG = [
  { modelId: "whisper-tiny", displayName: "Whisper Tiny", multilingual: true, sizeBytes: 0, sourceUrl: "", checksum: "" },
  { modelId: "whisper-base", displayName: "Whisper Base", multilingual: true, sizeBytes: 0, sourceUrl: "", checksum: "" },
  { modelId: "whisper-small", displayName: "Whisper Small", multilingual: true, sizeBytes: 0, sourceUrl: "", checksum: "" },
] as const;
```

`model-store.ts` should update installed model records in app config without duplicating download logic.

- [ ] **Step 4: Implement download manager**

`download-manager.ts` should:
- stream downloads to the models directory
- emit byte progress and status transitions on the runtime bus
- verify checksums before marking models ready
- clean up partial artifacts on failure

- [ ] **Step 5: Re-run focused ASR model tests**

Run:
```bash
npm run test --workspace @ai-emotion/desktop -- model-catalog.test.ts download-manager.test.ts
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add desktop/src/runtime/asr/model-catalog.ts desktop/src/runtime/asr/model-store.ts desktop/src/runtime/asr/download-manager.ts desktop/src/__tests__/runtime/asr/model-catalog.test.ts desktop/src/__tests__/runtime/asr/download-manager.test.ts
git commit -m "feat(desktop): add whisper model catalog and download manager"
```

### Task 8: Add Mic Capture Bridge and Whisper Runner

**Files:**
- Create: `desktop/src/main/windows/create-capture-window.ts`
- Create: `desktop/src/capture/index.html`
- Create: `desktop/src/capture/index.ts`
- Create: `desktop/src/capture/audio-worklet-bridge.ts`
- Create: `desktop/src/runtime/asr/whisper-runner.ts`
- Create: `desktop/src/runtime/asr/asr-worker.ts`
- Create: `desktop/src/__tests__/runtime/asr/asr-session-service.test.ts`

- [ ] **Step 1: Write failing ASR session tests**

Add tests asserting:
- listening start is blocked when no ready model exists
- recognition strategy rejects unsupported fixed language
- PCM frames received from the capture bridge produce one finalized transcript event when a segment closes
- switching model while listening returns `ASR_MODEL_SWITCH_BLOCKED_WHILE_LISTENING`

- [ ] **Step 2: Run ASR session test to verify failure**

Run:
```bash
npm run test --workspace @ai-emotion/desktop -- asr-session-service.test.ts
```
Expected: FAIL because session orchestration and whisper runner are missing.

- [ ] **Step 3: Implement hidden capture window**

Use a hidden BrowserWindow for microphone capture so the product stays desktop-native without exposing ASR work to the visible renderer:
- `create-capture-window.ts` creates a hidden secure window
- `desktop/src/capture/index.ts` acquires `getUserMedia({ audio: true })`
- `audio-worklet-bridge.ts` normalizes PCM chunks and forwards them to the ASR runtime via `ipcRenderer.postMessage`

Keep the visible renderer free of microphone capture logic.

- [ ] **Step 4: Implement Whisper runner and ASR worker**

Use `@huggingface/transformers` with `onnxruntime-node` in the ASR runtime to:
- load the active local model from the app data model path
- apply `auto` or fixed-language settings
- accumulate PCM frames into segment windows
- emit final transcript payloads only

- [ ] **Step 5: Re-run ASR session test**

Run:
```bash
npm run test --workspace @ai-emotion/desktop -- asr-session-service.test.ts
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add desktop/src/main/windows/create-capture-window.ts desktop/src/capture desktop/src/runtime/asr/whisper-runner.ts desktop/src/runtime/asr/asr-worker.ts desktop/src/__tests__/runtime/asr/asr-session-service.test.ts
git commit -m "feat(desktop): add capture bridge and whisper asr runtime"
```

### Task 9: Orchestrate Listening Sessions and Emotion Hand-off

**Files:**
- Create: `desktop/src/runtime/asr/asr-session-service.ts`
- Modify: `desktop/src/main/ipc/register-ipc.ts`
- Modify: `desktop/src/main/ipc/runtime-bus.ts`
- Modify: `desktop/src/runtime/emotion/emotion-worker.ts`
- Modify: `desktop/src/__tests__/runtime/asr/asr-session-service.test.ts`

- [ ] **Step 1: Extend failing session tests for full event flow**

Add assertions for:
- `startListening` publishes `session:status`
- completed transcript enqueues emotion analysis
- emotion completion emits `emotion:started` then `emotion:result`
- `stopListening` flushes or closes the session cleanly without orphaned listeners

- [ ] **Step 2: Run full session test to verify failure**

Run:
```bash
npm run test --workspace @ai-emotion/desktop -- asr-session-service.test.ts
```
Expected: FAIL because transcript-to-emotion orchestration is incomplete.

- [ ] **Step 3: Implement session orchestration**

`asr-session-service.ts` should:
- enforce model readiness
- enforce listening state transitions
- subscribe to capture bridge frames
- forward final transcripts into the emotion queue
- publish runtime snapshot and incremental events on the shared bus

- [ ] **Step 4: Re-run full session test**

Run:
```bash
npm run test --workspace @ai-emotion/desktop -- asr-session-service.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/runtime/asr/asr-session-service.ts desktop/src/main/ipc/register-ipc.ts desktop/src/main/ipc/runtime-bus.ts desktop/src/runtime/emotion/emotion-worker.ts desktop/src/__tests__/runtime/asr/asr-session-service.test.ts
git commit -m "feat(desktop): orchestrate listening sessions and emotion handoff"
```

## Chunk 4: Renderer Migration to Desktop IPC

### Task 10: Add Renderer Desktop Client and Remove Endpoint Dependency

**Files:**
- Create: `client/lib/desktop/desktop-client.ts`
- Create: `client/lib/desktop/desktop-events.ts`
- Create: `client/lib/desktop/__tests__/desktop-client.test.ts`
- Modify: `client/app/page.tsx`
- Modify: `client/components/settings/SettingsPage.tsx`
- Modify: `client/lib/types.ts`

- [ ] **Step 1: Write failing renderer desktop-client tests**

Create tests for:
- snapshot fetch through preload-backed client
- event subscription maps desktop runtime events into the existing reducer shape
- start/stop listening calls use desktop client instead of HTTP fetch
- settings page no longer loads runtime endpoint config

- [ ] **Step 2: Run focused renderer test to verify failure**

Run:
```bash
cd client
npm run test:unit -- lib/desktop/__tests__/desktop-client.test.ts app/__tests__/ConsoleRoute.test.tsx components/settings/__tests__/SettingsPage.test.tsx
```
Expected: FAIL because desktop client and endpoint removal are not implemented.

- [ ] **Step 3: Implement desktop client layer**

`client/lib/desktop/desktop-client.ts` should wrap the preload API behind a stable app-facing client:

```ts
export type DesktopRuntimeClient = {
  getSnapshot(): Promise<RuntimeSnapshot>;
  startListening(): Promise<void>;
  stopListening(): Promise<void>;
  subscribe(listener: (event: RuntimeEvent) => void): () => void;
  getAsrSettings(): Promise<AsrSettingsState>;
};
```

Update `client/app/page.tsx` to:
- remove `loadRuntimeConfig`
- remove fetch/WebSocket setup
- initialize from desktop snapshot
- subscribe to desktop events

Update `client/components/settings/SettingsPage.tsx` to remove the endpoint section from the desktop path.

- [ ] **Step 4: Re-run focused renderer tests**

Run:
```bash
cd client
npm run test:unit -- lib/desktop/__tests__/desktop-client.test.ts app/__tests__/ConsoleRoute.test.tsx components/settings/__tests__/SettingsPage.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/lib/desktop client/app/page.tsx client/components/settings/SettingsPage.tsx client/lib/types.ts
git commit -m "refactor(client): switch renderer transport from http ws to desktop ipc"
```

### Task 11: Add ASR Model and Recognition Strategy Settings UI

**Files:**
- Create: `client/components/settings/SettingsAsrModelSection.tsx`
- Create: `client/components/settings/SettingsRecognitionStrategySection.tsx`
- Create: `client/components/settings/__tests__/SettingsAsrModelSection.test.tsx`
- Create: `client/components/settings/__tests__/SettingsRecognitionStrategySection.test.tsx`
- Modify: `client/components/settings/SettingsProviderSection.tsx`
- Modify: `client/lib/i18n.tsx`
- Modify: `client/components/settings/SettingsPage.tsx`

- [ ] **Step 1: Write failing settings-section tests**

Cover:
- model list renders predefined models with per-model status
- download button dispatches model download
- progress state renders percentage/status copy
- activate button is disabled while listening
- recognition strategy toggles `Auto Detect` and `Fixed Language`
- fixed language chooser offers only Chinese and English

- [ ] **Step 2: Run focused settings tests to verify failure**

Run:
```bash
cd client
npm run test:unit -- components/settings/__tests__/SettingsAsrModelSection.test.tsx components/settings/__tests__/SettingsRecognitionStrategySection.test.tsx
```
Expected: FAIL because sections and strings are missing.

- [ ] **Step 3: Implement desktop ASR settings UI**

Add desktop-specific copy in `client/lib/i18n.tsx`:
- ASR model title/description
- download/activate/delete/progress strings
- recognition strategy labels
- listening-blocked explanatory messages

Implement `SettingsAsrModelSection.tsx` and `SettingsRecognitionStrategySection.tsx` as focused components fed by `SettingsPage`.

Keep `SettingsProviderSection.tsx` but source provider data from the desktop client, not from an API base URL.

- [ ] **Step 4: Re-run focused settings tests**

Run:
```bash
cd client
npm run test:unit -- components/settings/__tests__/SettingsAsrModelSection.test.tsx components/settings/__tests__/SettingsRecognitionStrategySection.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/components/settings/SettingsAsrModelSection.tsx client/components/settings/SettingsRecognitionStrategySection.tsx client/components/settings/__tests__/SettingsAsrModelSection.test.tsx client/components/settings/__tests__/SettingsRecognitionStrategySection.test.tsx client/components/settings/SettingsProviderSection.tsx client/components/settings/SettingsPage.tsx client/lib/i18n.tsx
git commit -m "feat(client): add desktop asr model and recognition strategy settings"
```

### Task 12: Adapt Dashboard to Final-Only Desktop Events

**Files:**
- Modify: `client/components/dashboard/DashboardShell.tsx`
- Modify: `client/components/dashboard/LiveTranscriptStage.tsx`
- Modify: `client/components/dashboard/UtteranceStreamPanel.tsx`
- Modify: `client/components/dashboard/__tests__/LiveTranscriptStage.test.tsx`
- Modify: `client/app/page.tsx`

- [ ] **Step 1: Write failing dashboard tests**

Cover:
- dashboard does not expect `asr_partial` events in the desktop path
- final transcript events update the live stage and utterance stream
- status badges still react to listening state and runtime errors
- empty-state messaging is correct before first transcript

- [ ] **Step 2: Run focused dashboard tests to verify failure**

Run:
```bash
cd client
npm run test:unit -- components/dashboard/__tests__/LiveTranscriptStage.test.tsx components/dashboard/__tests__/UtteranceStreamPanel.test.tsx
```
Expected: FAIL because reducer and UI still assume partial transcript behavior.

- [ ] **Step 3: Implement final-only transcript behavior**

Update reducer and UI so that:
- `currentPartial` becomes optional or desktop-only empty state
- the latest finalized utterance drives the stage
- transcript freshness still reflects the last finalized event
- event mapping uses desktop event names/contracts while preserving domain objects

- [ ] **Step 4: Re-run focused dashboard tests**

Run:
```bash
cd client
npm run test:unit -- components/dashboard/__tests__/LiveTranscriptStage.test.tsx components/dashboard/__tests__/UtteranceStreamPanel.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/components/dashboard/DashboardShell.tsx client/components/dashboard/LiveTranscriptStage.tsx client/components/dashboard/UtteranceStreamPanel.tsx client/components/dashboard/__tests__/LiveTranscriptStage.test.tsx client/app/page.tsx
git commit -m "refactor(client): adapt dashboard to desktop final transcript events"
```

## Chunk 5: Verification, Cleanup, and Handoff

### Task 13: End-to-End Verification and Documentation

**Files:**
- Modify: `README.md`
- Optional cleanup: obsolete Python entrypoints and docs

- [ ] **Step 1: Run desktop and client verification**

Run:
```bash
npm install
npm run test --workspace @ai-emotion/contracts
npm run test --workspace @ai-emotion/desktop
cd client
npm run lint
npm run test:unit
npm run build
cd ..
npm run desktop:build
```
Expected: all checks PASS and Electron production build succeeds.

- [ ] **Step 2: Perform manual smoke verification**

Run the desktop app and verify:
- first-run empty model state points users to download a model
- model download shows progress
- model activation works only when idle
- start/stop listening works
- a final transcript appears
- emotion inference result appears
- provider management works
- OSC output is emitted

Document any platform-specific caveats found on macOS and Windows.

- [ ] **Step 3: Update README**

Update `README.md` to describe:
- Electron desktop architecture
- root workspace commands
- model download behavior
- desktop settings surface
- removal of Python/Vosk from the main path

- [ ] **Step 4: Remove or mark obsolete Python path**

After desktop parity is confirmed, either:
- delete obsolete Python runtime entrypoints and docs, or
- clearly mark them deprecated if temporary coexistence is still needed

Do not remove the Python path until the Electron desktop path is demonstrably working.

- [ ] **Step 5: Final review and commit**

```bash
git add README.md server main.py speech_recognizer.py voice_processor.py start.bat dev.bat
git commit -m "docs: document electron desktop runtime and retire python path"
```

## Plan Review Notes

Because this session did not include explicit user authorization to dispatch subagents, review this plan locally against `docs/superpowers/specs/2026-04-01-electron-ipc-whisper-desktop-migration-design.md` before execution. Verify:

1. No task reintroduces HTTP/WebSocket runtime transport
2. No task expands fixed-language support beyond `zh` and `en`
3. No task adds live partial transcript as a phase-one requirement
4. Provider persistence remains encrypted at rest in SQLite
5. Renderer never talks to raw Electron APIs outside the desktop client layer

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-01-electron-ipc-whisper-desktop-migration-implementation.md`. Ready to execute?
