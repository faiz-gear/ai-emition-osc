# Resonote Production Desktop Architecture Design

- Date: 2026-04-12
- Status: Ready for review
- Target repository: `ai-emotion`
- Scope: Desktop production architecture hardening

## 1. Background and Goal

The current branch already has the right top-level desktop direction:

1. Electron main + preload + Next.js renderer are in place
2. `packages/contracts` defines typed IPC and runtime event contracts
3. `desktop/src/runtime` already contains real desktop-oriented modules for ASR, provider persistence, encryption, OSC, and local config

However, the shipped default bootstrap is still not a production desktop runtime. `desktop/src/main/index.ts` and `desktop/src/main/ipc/register-ipc.ts` both fall back to `getDefaultDesktopIpcServices()` from `desktop/src/main/ipc/in-memory-desktop-ipc-services.ts`. That keeps the renderer contract moving, but it also means:

1. the default app path is still backed by an in-memory harness
2. real runtime modules exist without a single production composition root
3. lifecycle, diagnostics, and teardown are spread across ad hoc wiring instead of an explicit runtime boundary

The goal of this design is to turn the current Electron migration into a production-grade desktop architecture without discarding the useful work that already exists.

## 2. Current-State Findings

### 2.1 What is already strong

1. The typed contract boundary is solid. `packages/contracts`, `desktop/src/preload`, and `client/lib/desktop/desktop-client.ts` already establish a good renderer-to-runtime contract.
2. Runtime modules are meaningfully decomposed. `app-config-store.ts`, `provider-repository.ts`, `provider-service.ts`, `download-manager.ts`, and `asr-session-service.ts` already isolate substantial behavior.
3. The renderer is no longer modeled as an HTTP/WebSocket client for the primary desktop path. That is the right long-term direction.

### 2.2 Production gaps

1. No explicit composition root for the real desktop runtime
2. No runtime mode selection model for `memory`, `desktop`, `test`, and future isolated worker modes
3. No dedicated diagnostics surface for startup failures, degraded dependencies, active model/provider state, and filesystem paths
4. No clean ownership split between pure runtime logic, agent/workflow orchestration, and Electron/platform adapters
5. No packaging and smoke-verification lane tied to the production runtime instead of the in-memory harness

## 3. External Reference Scan

The repo scan should be grounded in other Electron + agent desktop projects rather than only generic Electron advice.

### 3.1 `eigent-ai/eigent`

Useful patterns observed:

1. Electron is treated as a desktop shell around a clearly separated agent stack, not as the place where all business logic lives.
2. The project explicitly distinguishes frontend, backend, state, and workflow/editor responsibilities.
3. The repo demonstrates that once a product becomes agent-centric, orchestration concerns deserve a first-class layer instead of being mixed directly into UI or shell code.

Why it matters here:

Resonote should avoid letting Electron `main` become the permanent home for ASR, provider policy, emotion orchestration, persistence, and future agent workflows all at once.

Reference:

- https://github.com/eigent-ai/eigent

### 3.2 `DeepFundAI/ai-browser`

Useful patterns observed:

1. The repo keeps desktop-specific concerns under an `electron/` area while also keeping app logic and `resources/skills` as explicit concepts.
2. Packaging and update artifacts are checked into the repo from day one (`electron-builder.yml`, `electron-update.yml`) instead of being postponed indefinitely.
3. The project treats skills/resources as part of the product surface, not just implementation detail.

Why it matters here:

Resonote should explicitly separate platform adapters from higher-level orchestration and make packaging/updates a planned capability, not an afterthought.

Reference:

- https://github.com/DeepFundAI/ai-browser

### 3.3 `bytedance/UI-TARS-desktop`

Useful patterns observed:

1. The repo is organized as a monorepo with `apps`, `packages`, `scripts`, `rfcs`, and infra concerns visible at the top level.
2. GUI-agent functionality is treated as a product subsystem with its own operator modes and real-time feedback model.
3. Architecture and evolution are documented in-repo rather than left implicit in implementation.

Why it matters here:

Resonote should keep production architecture legible through explicit package or layer boundaries and design docs, especially as desktop capability expands beyond the first local runtime milestones.

Reference:

- https://github.com/bytedance/UI-TARS-desktop

### 3.4 `electron/llm`

Useful patterns observed:

1. Electron maintainers treat local model execution as a separate process-architecture concern, not something that should automatically live inside the renderer or UI path.
2. The package uses a utility process and efficient IPC as the reference design for heavier local model workloads.
3. Model-path ownership is tied to `userData`, which matches desktop expectations for mutable runtime state.

Why it matters here:

Resonote does not need to move Whisper or emotion inference into a utility process immediately, but the architecture should make that evolution possible without rewriting renderer contracts later.

Reference:

- https://github.com/electron/llm

## 4. Architecture Options Considered

### Option A: Keep the current in-memory default and patch around it

Description:

Keep `getDefaultDesktopIpcServices()` as the default bootstrap and gradually add exceptions for real runtime modules.

Pros:

1. Lowest short-term disruption
2. Minimal changes to current tests

Cons:

1. Production behavior remains ambiguous
2. Lifecycle ownership stays hidden behind a singleton helper
3. Real persistence and diagnostics remain second-class
4. Test harness and shipped runtime continue to drift apart

Decision:

Reject. This preserves the main architecture problem.

### Option B: Wire the real runtime directly into `main/index.ts`

Description:

Replace the in-memory default with direct calls that instantiate config store, model store, provider repository, and runtime services inline in Electron main.

Pros:

1. Faster than a larger refactor
2. Makes the shipped path more real immediately

Cons:

1. Electron main becomes the permanent assembly and policy dumping ground
2. Future test modes and utility-process evolution become harder
3. Diagnostics and cleanup still have no explicit owner

Decision:

Reject. Better than the current state, but still not a sustainable production shape.

### Option C: Introduce a composition root plus runtime modes, runtime-core, and agent-core

Description:

Create an explicit production runtime assembly layer, keep the in-memory services as a dedicated non-production mode, and separate platform adapters from orchestration logic.

Pros:

1. Clear default shipped runtime
2. Test and development harnesses remain useful without pretending to be production
3. Easier evolution toward isolated worker processes
4. Better diagnostics, shutdown, smoke testing, and packaging discipline

Cons:

1. Requires several structural changes before user-visible behavior changes
2. Needs careful migration to avoid breaking current tests

Decision:

Choose this option.

## 5. Chosen Architecture

### 5.1 Target layering

The production desktop path should converge on five layers.

| Layer | Responsibility | Notes |
| --- | --- | --- |
| Contracts | Shared IPC/domain contracts in `packages/contracts` | Keep renderer and runtime loosely coupled |
| Runtime Core | Pure application services and state transitions | ASR session logic, download state rules, provider policies, runtime event shaping |
| Agent Core | Higher-level orchestration/use-case layer | Emotion pipeline coordination today; future tool/workflow orchestration tomorrow |
| Platform Adapters | Electron, filesystem, SQLite, crypto, OSC, model files | Replaceable adapters, not policy owners |
| Desktop Composition Root | Creates the active runtime mode and wires services into Electron main | The only place that decides what runtime ships |

### 5.2 Runtime modes

Introduce an explicit runtime mode enum instead of hidden singleton defaults:

1. `memory`
2. `desktop`
3. `test`
4. `utility` or `isolated` as a future extension point

Rules:

1. `desktop` is the default shipped mode
2. `memory` is allowed only for development harnesses, preview environments, or focused tests
3. mode selection happens in the composition root, never inside `registerIpc()`

### 5.3 Composition root

Create a dedicated assembly entrypoint, for example:

1. `desktop/src/main/runtime/runtime-mode.ts`
2. `desktop/src/main/runtime/create-desktop-runtime.ts`
3. `desktop/src/main/runtime/create-memory-runtime.ts`
4. `desktop/src/main/runtime/create-runtime-context.ts`

The composition root owns:

1. runtime mode resolution
2. app paths and mutable storage locations
3. service construction order
4. disposal/shutdown ordering
5. startup diagnostics

`registerIpc()` should take an explicit `DesktopIpcServices` object and never import a default implementation itself.

### 5.4 Runtime-core and agent-core split

The current `desktop/src/runtime` folder already contains valuable code, but its concerns are mixed.

Recommended split:

1. `runtime-core`
   - session state machines
   - download status transitions
   - provider validation and activation rules
   - event normalization
2. `agent-core`
   - transcript-to-emotion orchestration
   - provider/model selection policy
   - future task/tool workflow coordination
   - retry and cancellation policy above individual services
3. `platform`
   - Electron path resolution
   - SQLite repository
   - encrypted secret storage
   - OSC adapter
   - model file persistence

The first implementation pass does not need a massive move-all-at-once rename. It can introduce these boundaries through new adapter/composition files and gradually relocate modules as tests stay green.

### 5.5 Diagnostics as a first-class subsystem

Add a small diagnostics surface instead of treating failures as ad hoc exceptions:

1. startup report with runtime mode, app paths, and dependency readiness
2. model/provider/config health summary
3. recent runtime errors and last failure codes
4. environment capability flags such as microphone permission and renderer asset resolution

This should be visible in:

1. logs
2. runtime events for the renderer
3. test assertions

### 5.6 Lifecycle and cleanup

The production runtime should expose a disposable contract, for example:

```ts
type DesktopRuntime = {
  services: DesktopIpcServices;
  diagnostics: RuntimeDiagnostics;
  dispose(): Promise<void>;
};
```

That gives one owner for:

1. stopping listening on shutdown
2. tearing down emotion queues and OSC clients
3. closing SQLite handles
4. destroying auxiliary windows
5. flushing pending diagnostics if needed

### 5.7 Packaging and release posture

Packaging is not the first code change, but it must be part of the architecture:

1. production runtime bootstrap must be buildable without dev-only assumptions
2. renderer asset resolution must be validated in tests
3. packaging config and smoke verification should target `desktop` mode, not `memory`
4. release readiness should include install/update/build artifacts as a tracked follow-on milestone

## 6. Recommended Incremental Migration

### Phase 1: Make the runtime mode explicit

1. Add composition-root files
2. Remove default-service imports from `main/index.ts` and `register-ipc.ts`
3. Keep current in-memory services, but only behind `memory` mode

### Phase 2: Wire the real desktop runtime as the default

1. Assemble config store, provider repository, provider service, model store, download manager, session service, and emotion pipeline under `desktop` mode
2. Keep current contracts unchanged where possible
3. Add integration tests for startup, provider activation, and model download state

### Phase 3: Add diagnostics and teardown discipline

1. Introduce runtime health snapshots
2. Standardize shutdown and failure reporting
3. Surface degraded states intentionally in UI and tests

### Phase 4: Harden packaging and smoke verification

1. Tie build verification to the production runtime
2. Add smoke scripts/checklists for GUI, mic, and provider readiness
3. Prepare installer/update work as a dedicated subproject

### Phase 5: Evaluate isolated heavy-workload execution

If CPU pressure, model-loading latency, or crash isolation becomes a real issue, move Whisper or higher-cost inference into a utility/worker process behind the same contracts.

## 7. Explicit Non-Goals

This design does not propose:

1. reverting to HTTP/WebSocket compatibility
2. redesigning the renderer UI
3. introducing cloud-only runtime dependencies
4. implementing a full general-purpose agent framework immediately
5. forcing Whisper into a separate process before the composition boundary exists

## 8. Success Criteria

The architecture is production-ready when all of the following are true:

1. the shipped desktop app defaults to a real persisted runtime, not the in-memory harness
2. Electron main no longer hides business-runtime assembly behind implicit singleton helpers
3. runtime mode is explicit and testable
4. diagnostics can explain startup and degraded states without source inspection
5. packaging and smoke validation exercise the same runtime mode users actually ship

## 9. Recommendation

Proceed with Option C.

The highest-leverage move is not a wholesale rewrite. It is to install a real composition root, make runtime mode explicit, keep the in-memory harness as a non-production tool, and then route the existing ASR/provider/config modules through a default `desktop` runtime. That gives Resonote a production architecture with room to grow into heavier agentic workflows later, without paying the cost of a premature process split today.
