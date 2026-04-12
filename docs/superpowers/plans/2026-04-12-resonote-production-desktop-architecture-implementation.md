# Resonote Production Desktop Architecture Implementation Plan

> Goal: Turn the current Electron migration into a production-grade desktop runtime by introducing an explicit composition root, runtime modes, diagnostics, and a real default persisted runtime path.

**Architecture:** Keep `packages/contracts` as the stable shared boundary, introduce a composition root under `desktop/src/main/runtime`, preserve the current in-memory services only as a non-production mode, and incrementally route the existing config/provider/ASR/emotion modules through a default `desktop` runtime with explicit lifecycle and diagnostics.

**Tech Stack:** Electron 31, electron-vite, Next.js 14 renderer, TypeScript, Vitest, better-sqlite3, local Whisper/ONNX runtime modules, LangChain provider adapters.

---

## Scope Check

This plan covers desktop runtime hardening only. It does not include a renderer redesign, server resurrection, or full installer/release automation implementation. Packaging readiness is planned, but full distribution workflows remain a follow-on.

## Research Trace

The plan is informed by:

1. local repo constraints in `desktop/src/main`, `desktop/src/runtime`, and `packages/contracts`
2. `eigent-ai/eigent` for agent-shell separation
3. `DeepFundAI/ai-browser` for Electron + app logic + packaging/resource boundaries
4. `bytedance/UI-TARS-desktop` for monorepo-level subsystem separation and GUI-agent runtime posture
5. `electron/llm` for process-boundary discipline around heavier local-model workloads

## File Targets

### New files

- `desktop/src/main/runtime/runtime-mode.ts`
- `desktop/src/main/runtime/create-runtime-context.ts`
- `desktop/src/main/runtime/create-desktop-runtime.ts`
- `desktop/src/main/runtime/create-memory-runtime.ts`
- `desktop/src/main/runtime/types.ts`
- `desktop/src/main/diagnostics/runtime-diagnostics.ts`
- `desktop/src/__tests__/main/runtime-mode.test.ts`
- `desktop/src/__tests__/main/create-desktop-runtime.test.ts`

### Modified files

- `desktop/src/main/index.ts`
- `desktop/src/main/ipc/register-ipc.ts`
- `desktop/src/main/ipc/in-memory-desktop-ipc-services.ts`
- `desktop/src/main/ipc/desktop-ipc-services.ts`
- `desktop/src/runtime/config/app-config-store.ts`
- `desktop/src/runtime/asr/download-manager.ts`
- `desktop/src/runtime/asr/asr-session-service.ts`
- `desktop/src/runtime/providers/provider-repository.ts`
- `desktop/src/runtime/providers/provider-service.ts`
- `packages/contracts/src/ipc.ts`
- `README.md`

### Optional later extraction targets

- `desktop/src/runtime-core/*`
- `desktop/src/agent-core/*`
- `desktop/src/platform/*`

These should be introduced only after composition-root behavior is stable.

## Implementation Unit 1: Composition Root and Runtime Mode

**Goal:** Remove hidden singleton bootstrap behavior and make the active runtime explicit.

**Files:**

- `desktop/src/main/index.ts`
- `desktop/src/main/ipc/register-ipc.ts`
- `desktop/src/main/runtime/runtime-mode.ts`
- `desktop/src/main/runtime/create-runtime-context.ts`
- `desktop/src/main/runtime/create-desktop-runtime.ts`
- `desktop/src/main/runtime/create-memory-runtime.ts`
- `desktop/src/main/runtime/types.ts`
- `desktop/src/__tests__/main/bootstrap.test.ts`
- `desktop/src/__tests__/main/runtime-mode.test.ts`

**Approach:**

1. Define a `RuntimeMode` type and environment/config-based resolver
2. Add a `DesktopRuntime` object that wraps `services`, `diagnostics`, and `dispose()`
3. Change Electron bootstrap to create the runtime once and pass its services into `registerIpc()`
4. Remove default-service imports from `registerIpc()`
5. Keep the in-memory services, but only behind `create-memory-runtime.ts`

**Patterns to follow:**

- `desktop/src/main/index.ts`
- `desktop/src/main/ipc/desktop-ipc-services.ts`
- `desktop/src/__tests__/main/bootstrap.test.ts`

**Test scenarios:**

1. Production bootstrap resolves `desktop` mode by default
2. Development/test mode can still opt into `memory`
3. `registerIpc()` refuses implicit global runtime construction
4. Window close and app shutdown both call runtime disposal

**Verification:**

- `npm run test --workspace @ai-emotion/desktop -- bootstrap.test.ts runtime-mode.test.ts`

## Implementation Unit 2: Real Desktop Runtime Assembly

**Goal:** Route the shipped runtime through persisted config, model storage, provider persistence, and real service construction.

**Files:**

- `desktop/src/main/runtime/create-desktop-runtime.ts`
- `desktop/src/runtime/config/app-config-store.ts`
- `desktop/src/runtime/asr/download-manager.ts`
- `desktop/src/runtime/asr/asr-session-service.ts`
- `desktop/src/runtime/asr/model-store.ts`
- `desktop/src/runtime/providers/provider-repository.ts`
- `desktop/src/runtime/providers/provider-service.ts`
- `desktop/src/runtime/emotion/emotion-service.ts`
- `desktop/src/runtime/emotion/emotion-worker.ts`
- `desktop/src/__tests__/main/create-desktop-runtime.test.ts`
- `desktop/src/__tests__/runtime/asr/download-manager.test.ts`
- `desktop/src/__tests__/runtime/providers/provider-service.test.ts`

**Approach:**

1. Build a real runtime assembly function that owns app paths, config store, provider repo/service, model store, runtime event bus, ASR session, emotion worker, and OSC adapter
2. Preserve current `DesktopIpcServices` contracts where possible so the renderer does not need a churn-heavy update
3. Ensure the real runtime owns shutdown and resource cleanup
4. Keep in-memory services available for tests and preview-only flows

**Patterns to follow:**

- `desktop/src/runtime/config/app-config-store.ts`
- `desktop/src/runtime/providers/provider-service.ts`
- `desktop/src/runtime/asr/download-manager.ts`

**Test scenarios:**

1. Startup resolves stable app-data paths and initializes persisted services
2. Provider list/create/update/activate flows work against SQLite-backed storage
3. Model download emits status and progress events, persists ready state, and survives event-consumer failures
4. ASR start/stop/model-switch rules still enforce idle-only transitions

**Verification:**

- `npm run test --workspace @ai-emotion/desktop -- create-desktop-runtime.test.ts download-manager.test.ts provider-service.test.ts asr-session-service.test.ts`

## Implementation Unit 3: Diagnostics and Degraded-State Visibility

**Goal:** Make startup failures and degraded runtime states observable without reading source.

**Files:**

- `desktop/src/main/diagnostics/runtime-diagnostics.ts`
- `desktop/src/main/runtime/types.ts`
- `desktop/src/main/runtime/create-desktop-runtime.ts`
- `packages/contracts/src/ipc.ts`
- `client/lib/desktop/desktop-events.ts`
- `client/components/ConnectionBadge.tsx`
- `client/components/settings/SettingsPage.tsx`

**Approach:**

1. Add a small diagnostics model containing runtime mode, path summary, active model/provider summary, and last known failure codes
2. Publish diagnostics through runtime events or an explicit getter
3. Surface degraded states in the renderer in a compact, non-invasive way
4. Ensure diagnostics remain available even when one subsystem fails to initialize fully

**Patterns to follow:**

- `desktop/src/main/ipc/runtime-bus.ts`
- `client/lib/desktop/desktop-events.ts`
- `client/components/ConnectionBadge.tsx`

**Test scenarios:**

1. Missing model/provider/config state yields diagnostics, not silent failure
2. Startup exception paths publish a stable error shape
3. Renderer can display degraded runtime state without blocking the whole UI

**Verification:**

- `npm run test --workspace @ai-emotion/desktop`
- `cd client && npm run test:unit`

## Implementation Unit 4: Runtime-Core and Agent-Core Boundary

**Goal:** Prevent Electron main and platform adapters from becoming the long-term home for orchestration logic.

**Files:**

- `desktop/src/runtime/*`
- `desktop/src/main/runtime/create-desktop-runtime.ts`
- optional new folders:
  - `desktop/src/runtime-core/*`
  - `desktop/src/agent-core/*`
  - `desktop/src/platform/*`

**Approach:**

1. Start with adapter wrappers and explicit ownership comments, not a full directory migration on day one
2. Classify modules by concern:
   - runtime-core: state transitions and pure service logic
   - agent-core: transcript/emotion/provider orchestration and future task workflows
   - platform: Electron/filesystem/SQLite/crypto/OSC
3. Only move modules after composition-root tests are stable

**Patterns to follow:**

- Existing `desktop/src/runtime` module seams
- `packages/contracts` portability discipline

**Test scenarios:**

1. Core logic can be instantiated without Electron globals
2. Agent orchestration can be tested with fake provider/model dependencies
3. Platform adapters stay thin and replaceable

**Verification:**

- Focused Vitest suites for moved modules
- No Electron-global dependency leaks into core-only tests

## Implementation Unit 5: Packaging and Smoke Readiness

**Goal:** Ensure the production runtime can be verified in the mode users actually ship.

**Files:**

- `README.md`
- packaging/build config touched by future work
- smoke checklist docs under `docs/superpowers/`

**Approach:**

1. Tie build verification to the `desktop` runtime mode
2. Add a manual smoke checklist for GUI, microphone, model download, provider activation, and OSC output
3. Prepare a dedicated packaging follow-up issue once the runtime path is no longer in-memory by default

**Patterns to follow:**

- `desktop/renderer-path.contract.json`
- existing root build scripts
- repo README verification sections

**Test scenarios:**

1. Production renderer path resolves correctly in packaged builds
2. Manual smoke can verify model download, transcript flow, provider activation, and OSC output against the real runtime

**Verification:**

- `npm run build`
- `npm run desktop:build`
- manual GUI smoke in a machine with mic + provider access

## Sequencing

1. Unit 1 first. Without explicit runtime mode and composition root, every other improvement stays ambiguous.
2. Unit 2 second. Make the real desktop runtime the shipped default.
3. Unit 3 third. Add diagnostics once the real runtime exists.
4. Unit 4 fourth. Refine boundaries after behavior is stabilized.
5. Unit 5 last. Use the stabilized runtime for packaging and smoke readiness.

## Risks and Controls

### Risk 1: Current tests are coupled to in-memory helpers

Control:

Keep the memory runtime as a deliberate test mode instead of deleting it immediately.

### Risk 2: Real runtime wiring introduces startup fragility

Control:

Add diagnostics and integration tests before broad renderer changes.

### Risk 3: Refactor turns into a directory rename marathon

Control:

Do the composition root first, then only extract runtime-core and agent-core where seams are already proven.

### Risk 4: Packaging work starts before shipped runtime behavior is stable

Control:

Gate packaging follow-up on Unit 2 and Unit 3 completion.

## Definition of Done

This plan is complete when:

1. Electron bootstrap creates an explicit `desktop` runtime by default
2. the in-memory services are limited to test/dev harness usage
3. diagnostics can explain runtime health and startup failures
4. existing ASR/provider/config modules are assembled through one owned runtime root
5. the README and project docs point future work at the production architecture path instead of the temporary harness
