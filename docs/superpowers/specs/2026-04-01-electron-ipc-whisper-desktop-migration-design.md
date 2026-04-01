# Electron IPC + Whisper Desktop Migration Design

- Date: 2026-04-01
- Status: Ready for user review
- Target repository: `ai-emotion`
- Scope: Subproject 1 only

## 1. Background and Goal

The current system is split between:

1. A Python FastAPI backend in `server/app`
2. A Next.js client in `client`
3. A local Vosk-based ASR pipeline

The user wants to replace the Python backend with a TypeScript desktop runtime, move the application to Electron, remove the current Vosk solution, and adopt local Whisper models. The desktop app should also expose local ASR configuration in the client, especially model management and language strategy.

This spec defines the first subproject only:

1. Migrate the app to Electron
2. Replace the Python backend with a TypeScript runtime
3. Remove local HTTP/WebSocket compatibility and switch the renderer to Electron IPC
4. Replace Vosk ASR with local Whisper models
5. Add client-side UI for local ASR model management and language strategy

The GitHub Actions packaging and release workflow is explicitly out of scope for this spec and will be handled as a separate subproject.

## 2. Confirmed Product Decisions

The following decisions were explicitly confirmed with the user during brainstorming:

1. ASR engine changes from Vosk to local Whisper models
2. The desktop app will not preserve FastAPI HTTP routes or WebSocket compatibility
3. The renderer will communicate through Electron IPC instead of `apiBase` and `wsUrl`
4. The Next.js client will be built and loaded inside Electron, not served by a local Next.js server in production
5. Whisper recognition runs in the local desktop runtime, not in the renderer
6. Local ASR model options come from a predefined model list; users do not provide custom URLs or local paths
7. Model files are stored in the app data directory, not the install directory
8. First release language strategy supports `Auto Detect`, fixed Chinese, and fixed English
9. The first release only needs segment-final transcripts, not live partial transcripts
10. Model download happens inside the app and must display progress
11. ASR model switching and language strategy switching are allowed only when listening is stopped

## 3. Goals and Non-Goals

### 3.1 Goals

1. Ship a desktop-first architecture with Electron as the application shell
2. Remove Python runtime dependencies from the main product path
3. Preserve the existing user-facing dashboard and provider management concepts where possible
4. Add reliable local model download, activation, and status reporting for Whisper ASR
5. Provide a clear ASR settings workflow for model selection and recognition strategy
6. Keep the system modular enough for a later packaging and release subproject

### 3.2 Non-Goals

1. GitHub Actions release automation
2. macOS/Windows notarization, signing, or installer policy details
3. Live partial transcript streaming
4. Arbitrary model source URLs or user-provided model paths
5. Broad multilingual fixed-language support in the first release
6. Migrating the browser app to remain runnable as a general HTTP client

## 4. Architecture Choice

### 4.1 Options considered

Three candidate architectures were discussed:

1. Electron main process plus local HTTP/WS server plus workers
2. Electron-native IPC with no local HTTP/WS interface
3. Electron shell launching a separately packaged backend process

### 4.2 Chosen architecture

This spec adopts **option 2: Electron-native IPC**.

Why this was selected:

1. The user explicitly approved dropping HTTP/WebSocket compatibility
2. IPC removes redundant local transport layers inside the desktop app
3. It enables a simpler mental model for settings, auth, and runtime coordination
4. It keeps the desktop product focused on its actual runtime boundaries instead of preserving a browser-first abstraction that is no longer needed

Trade-off:

1. The current client transport layer must be rewritten from HTTP/WS to preload IPC
2. Existing runtime endpoint settings become obsolete and must be removed or replaced in the desktop UI

## 5. System Architecture

The desktop application is divided into four units with explicit responsibilities.

### 5.1 Electron main process

Responsibilities:

1. Create application windows and manage desktop lifecycle
2. Own the application data directory and runtime file locations
3. Register IPC commands and event subscriptions
4. Coordinate model downloads and background task status
5. Route commands to runtime workers
6. Persist desktop configuration and lightweight runtime state

Must not:

1. Perform long-running Whisper inference directly
2. Perform long-running LLM calls directly
3. Expose Node internals directly to the renderer

### 5.2 Preload bridge

Responsibilities:

1. Expose a minimal typed API to the renderer
2. Validate and normalize IPC inputs at the bridge boundary
3. Hide Electron-specific details from the React application

The renderer should depend on a single client abstraction, not on raw `window.electron` calls scattered through components.

Security rule:

1. Preload validation is a convenience layer, not the trust boundary
2. The main process must independently validate every renderer-originated command before mutating state or touching the filesystem

### 5.3 ASR worker

Responsibilities:

1. Manage microphone capture
2. Manage Whisper model loading and unloading
3. Execute model downloads and verification delegated by the main process
4. Segment speech and emit final transcript events
5. Enforce language strategy during recognition

Must not:

1. Manage provider credentials
2. Call LLM providers directly

### 5.4 Emotion/runtime worker

Responsibilities:

1. Hold provider registry and provider configuration logic in TypeScript
2. Perform LangChain TypeScript model calls for emotion analysis
3. Normalize emotion outputs into the existing domain schema
4. Maintain emotion queue semantics
5. Send OSC output

Must not:

1. Own microphone lifecycle
2. Own model download state

## 6. Renderer Integration

The built Next.js app is loaded into Electron as the renderer UI.

### 6.1 Client transport changes

Current browser transport concepts:

1. `apiBase`
2. `wsUrl`
3. HTTP fetchers
4. WebSocket event stream

Desktop transport replacement:

1. Command APIs exposed from preload
2. Event subscription APIs exposed from preload
3. A renderer-side desktop runtime client layer that adapts these APIs into the same domain objects used by the current UI

### 6.2 Compatibility strategy inside the renderer

The renderer should preserve domain semantics where practical:

1. `Utterance`
2. `EmotionResult`
3. `ProviderSummary`
4. snapshot-like initial state hydration
5. incremental status/error/result events

The renderer should not preserve browser deployment assumptions:

1. No endpoint configuration UI
2. No runtime API base editing
3. No browser WebSocket reconnection layer

## 7. Desktop Configuration Model

All desktop configuration is stored under the application data directory.

Suggested root:

1. macOS: `~/Library/Application Support/ai-emotion`
2. Windows: `%AppData%/ai-emotion`

Suggested subdirectories:

1. `config/`
2. `models/`
3. `data/`
4. `logs/`

### 7.1 App config structure

The desktop config store must contain at least:

1. `asr.currentModelId`
2. `asr.languageMode` with values `auto | fixed`
3. `asr.fixedLanguage` with values `zh | en | null`
4. `asr.installedModels[]`
5. `providers` persistent data
6. `osc` target config

Provider persistence rule:

1. Provider configuration should continue using SQLite in the desktop runtime to preserve the current repository and migration shape
2. Provider secrets must remain encrypted at rest
3. The database file should live under the application data directory, not in the packaged app bundle

### 7.2 Installed model record

Each installed model record should contain:

1. `modelId`
2. `displayName`
3. `version`
4. `variant`
5. `downloadedAt`
6. `verifiedAt`
7. `sizeBytes`
8. `status` with values `not_downloaded | downloading | ready | failed`
9. `localPath`
10. Optional `lastErrorCode`
11. Optional `lastErrorMessage`

## 8. Whisper Model Management

### 8.1 Model catalog

The first release uses a predefined catalog curated by the app. Users cannot enter custom download URLs or arbitrary local model paths.

The catalog should remain small in the first release. A reasonable initial set is:

1. `tiny`
2. `base`
3. `small`

Each catalog item should define:

1. Stable `modelId`
2. Display name
3. Intended use description
4. Approximate size
5. Language coverage notes
6. Download source metadata
7. Checksum or equivalent integrity metadata

### 8.2 Download flow

Download lifecycle:

1. Renderer invokes `downloadModel(modelId)`
2. Main process validates the request and starts a tracked download task
3. Download progress is emitted to the renderer as structured progress events
4. The downloaded artifact is verified before activation is allowed
5. The model record is updated to `ready` only after verification succeeds

Progress states must include:

1. `queued`
2. `downloading`
3. `verifying`
4. `ready`
5. `failed`

Download errors must distinguish at least:

1. `NETWORK_ERROR`
2. `CHECKSUM_MISMATCH`
3. `PERMISSION_DENIED`
4. `DISK_FULL`
5. `UNSUPPORTED_PLATFORM`

### 8.3 Activation and deletion rules

1. A model can be activated only if its status is `ready`
2. Activation is blocked while listening is active
3. Deletion is blocked for the active model unless the user switches to another ready model first
4. If no ready model exists, listening cannot start and the UI must show a recoverable error
5. On first install, if no model has been downloaded yet, the settings experience must make model download the primary next step instead of failing silently

## 9. Recognition Strategy

The ASR recognition strategy is intentionally small in the first release.

### 9.1 Supported modes

1. `Auto Detect`
2. `Fixed Chinese`
3. `Fixed English`

### 9.2 Behavior

1. `Auto Detect` optimizes flexibility in multilingual environments
2. `Fixed Chinese` and `Fixed English` optimize stability and latency when the speaker context is known
3. Strategy changes are blocked while listening is active
4. Strategy changes take effect on the next listening session after a successful save

### 9.3 Out-of-scope behavior

The first release does not include:

1. User-defined fixed languages outside `zh` and `en`
2. Per-session ad hoc language overrides from the dashboard
3. Mixed live partial transcript and final transcript stabilization logic

## 10. Recognition and Emotion Data Flow

### 10.1 Listening flow

1. Renderer invokes `session.startListening()`
2. Main process validates runtime readiness
3. Main process instructs the ASR worker to start microphone capture with the active Whisper model and language strategy
4. ASR worker emits state updates and final transcript events
5. Main process publishes those events to renderer subscribers
6. Final transcript events are forwarded to the emotion worker
7. Emotion worker performs analysis and emits normalized emotion results
8. Main process forwards emotion events to the renderer and OSC service

### 10.2 Transcript behavior

The first release only emits final transcript events for completed segments.

Implications:

1. The dashboard no longer relies on continuous partial transcript updates
2. Existing transcript UI may need a simplified pending/idle state model
3. Emotion analysis starts after each finalized segment, not during active speech

### 10.3 Event model

The IPC event system should preserve domain-oriented event names where useful. A minimum set:

1. `runtime:snapshot`
2. `session:status`
3. `asr:final`
4. `emotion:queued`
5. `emotion:started`
6. `emotion:result`
7. `download:progress`
8. `runtime:error`

The exact channel naming may change during implementation, but the spec requires:

1. Strongly typed payloads
2. Stable event semantics
3. Explicit unsubscribe support

## 11. Provider and Emotion Runtime Migration

The current Python provider abstraction should be migrated conceptually, not mechanically.

### 11.1 Provider runtime expectations

The TypeScript runtime must support:

1. Provider CRUD
2. Provider activation
3. Provider testing
4. Encrypted secret persistence
5. Current provider types:
   `ollama`
   `openai`
   `openai_compatible`

### 11.2 LangChain migration

The emotion runtime should use the TypeScript LangChain ecosystem and preserve the current high-level behavior:

1. Prompt template interpolation
2. Structured output first, raw JSON extraction fallback second
3. Normalized eight-dimension emotion schema

### 11.3 Queue behavior

The current queue policy should remain configurable, but the first implementation may keep a single default policy if that materially reduces migration risk. If only one policy is shipped initially, the chosen default must be documented during implementation planning.

## 12. Settings UI Changes

The Settings page should be reorganized into desktop-relevant sections:

1. `Language`
2. `ASR Model`
3. `Recognition Strategy`
4. `Provider`

The current `Endpoint` section should be removed from the desktop renderer.

### 12.1 ASR Model section requirements

The section must show:

1. Current active model
2. All predefined model options
3. Per-model status
4. Download progress
5. Activate action
6. Delete action when allowed
7. Clear failure messaging when a download or verification fails

### 12.2 Recognition Strategy section requirements

The section must show:

1. `Auto Detect` option
2. `Fixed Language` option
3. Fixed language chooser for `Chinese` and `English`
4. Disabled state and explanatory copy while listening is active

## 13. Error Handling

The desktop runtime must use stable error codes, not free-form strings as the primary contract.

Minimum categories:

1. microphone errors
2. model download errors
3. model activation errors
4. recognition errors
5. provider errors
6. emotion parsing errors
7. OSC errors

Examples of required stable codes:

1. `MIC_PERMISSION_DENIED`
2. `MIC_DEVICE_MISSING`
3. `MIC_DEVICE_BUSY`
4. `ASR_MODEL_NOT_READY`
5. `ASR_MODEL_SWITCH_BLOCKED_WHILE_LISTENING`
6. `ASR_LANGUAGE_CHANGE_BLOCKED_WHILE_LISTENING`
7. `ASR_DOWNLOAD_NETWORK_ERROR`
8. `ASR_DOWNLOAD_CHECKSUM_MISMATCH`
9. `ASR_DOWNLOAD_DISK_FULL`
10. `PROVIDER_ACTIVE_NOT_SET`

The UI should map codes to localized human-facing copy.

## 14. Testing Strategy

### 14.1 Unit tests

1. Desktop config store validation
2. Model catalog and status transitions
3. Download task state machine
4. Recognition strategy validation
5. Provider secret handling
6. Emotion result normalization
7. IPC argument and payload validation

### 14.2 Integration tests

1. Renderer client layer against mocked preload API
2. Main process to worker command flow
3. Model download plus activation flow
4. Start/stop listening flow
5. Final transcript to emotion result flow
6. Provider management flow

### 14.3 Desktop smoke tests

At minimum:

1. App boots on macOS
2. App boots on Windows
3. A predefined model downloads successfully
4. The active model can be switched when idle
5. Listening can start and stop
6. A final transcript can be produced
7. Emotion analysis can complete
8. OSC output can be emitted

## 15. Migration Impact

Areas expected to change materially:

1. `server/` Python backend becomes obsolete on the main product path
2. Client transport utilities based on HTTP and WebSocket become obsolete
3. Settings UI needs desktop-specific structure
4. Dashboard live transcript behavior needs to reflect final-only ASR in phase one

Areas intentionally preserved conceptually:

1. Provider management capability
2. Emotion schema
3. Dashboard monitoring intent
4. OSC output support

## 16. Open Constraints for Implementation Planning

These are not product ambiguities, but implementation planning checkpoints that must be resolved in the next phase:

1. Exact Electron build toolchain choice
2. Exact Whisper runtime package and model artifact format
3. Exact desktop config persistence library
4. Exact worker implementation mechanism: Worker Threads or child process
5. Exact download source hosting arrangement for predefined models

These do not block the design because they are implementation choices within already approved boundaries.
