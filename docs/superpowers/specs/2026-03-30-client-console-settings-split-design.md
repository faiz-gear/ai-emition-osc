# AI Emotion Client Console/Settings Split Design

Date: 2026-03-30  
Scope: `/client` frontend information architecture and route split only (no backend API changes)

## 1. Context

Current `client` is a single dashboard page that mixes runtime operations and configuration capabilities:
- Realtime console capabilities (start/stop listening, transcript stream, metrics, emotion details)
- Configuration-related capabilities (language toggle, endpoint display, provider advanced panel)

Target is to separate product intent into two clear menus/pages:
- Console page: operations only
- Settings page: language, endpoint, and emotion model provider configuration

Confirmed decisions:
- Top navigation should be tabs
- Default route enters console
- Settings must support editing and persisting endpoints
- Provider should support full management (create/edit/test/delete/activate)
- Language persistence remains frontend-only (`localStorage`)

## 2. Goals and Non-Goals

### 2.1 Goals

- Split current single mixed page into two route-level pages:
  - `/` as Console
  - `/settings` as Settings
- Remove configuration controls from Console page entirely.
- Provide top tab navigation (localized labels) with clear active state.
- Keep behavior continuity for existing realtime console interactions.
- Enable local editable endpoint configuration that both pages consume consistently.

### 2.2 Non-Goals

- No backend API contract change.
- No backend persistence for locale or endpoint settings.
- No new business domains (auth, permissions, billing, etc.).

## 3. Chosen Approach

Chosen approach: **Route-level split + shared shell**.

Reasoning:
- Strongest IA clarity and long-term maintainability.
- Correct URL semantics (bookmark/share/back-forward).
- Low risk because existing console and provider modules can largely be reused.

## 4. Information Architecture

### 4.1 Routes

- `/`: Console page (runtime operations only)
- `/settings`: Settings page (configuration only)

### 4.2 Navigation

- Add shared top tabs with i18n labels (Chinese example: `控制台 | 配置`).
- Active tab reflects current route with accessible state (`aria-current`).
- Navigation is route-based, not in-page toggle state.

### 4.3 Page Boundaries

- Console page contains:
  - `ControlRail`
  - `LiveTranscriptStage`
  - `RealtimeOpsStack`
  - `UtteranceStreamPanel`
  - `EmotionDetailPanel`
- Settings page contains:
  - Language settings section
  - Endpoint settings section (editable)
  - Provider settings section (full manager)

No configuration entry remains on Console page.

## 5. Component and File Design

### 5.1 Routing and Shell

- Keep `client/app/page.tsx` as Console container route.
- Add `client/app/settings/page.tsx` for Settings route.
- Add shared shell component (e.g. `client/components/navigation/AppShell.tsx`) for:
  - common top header
  - tab navigation
  - page content slot
- Keep `client/app/layout.tsx` as Server Component for metadata and document structure.
- Add a dedicated client-only wrapper component (e.g. `client/components/providers/ClientProviders.tsx`) mounted inside layout body to host `DashboardI18nProvider`.

### 5.2 Console Page Refactor

- `DashboardShell` removes:
  - language switcher area
  - endpoint display area
  - `ProviderAdvancedPanel` rendering
- Existing console business state management in `app/page.tsx` remains local to Console route.

### 5.3 Settings Page Composition

Recommended section components:
- `SettingsLanguageSection`
- `SettingsEndpointSection`
- `SettingsProviderSection`

`SettingsProviderSection` reuses existing `ProviderManager`.

### 5.4 Interface Contracts

- `AppShell`
  - Inputs: `activeTab: "console" | "settings"`, `children`
  - Behavior: renders localized tab labels from i18n keys; tab clicks navigate by route.
- `SettingsEndpointSection`
  - Inputs: `value: RuntimeConfig`, `isSaving`, `errorMessage`, `warningCode`, `dismissedWarningCodes`
  - Callbacks: `onSave(next: RuntimeConfigInput): Promise<RuntimeConfigActionResult>`, `onReset(): Promise<RuntimeConfigActionResult>`
  - Note: this section does not emit extra output events; it only invokes callbacks and renders returned outcome.
- `SettingsProviderSection`
  - Inputs: `apiBase`, `apiBaseRevision`
  - Behavior: renders `ProviderManager` with `key={apiBaseRevision}` to force clean remount when endpoint changes.
- `SettingsPage` orchestration
  - Owns current runtime config state and distributes `apiBase` to provider section.
  - Applies atomic endpoint updates so language/provider blocks observe the same committed config snapshot.
  - Owns `apiBaseRevision` token and increments it after every successful save/reset.
  - Does not own provider active state; active provider source-of-truth stays inside `ProviderManager` data flow (`GET /api/providers` / activation response).

## 6. Runtime Config Data Model (Frontend-Only)

Runtime config helpers in `client/lib/config.ts`:
- `loadRuntimeConfig()`
- `saveRuntimeConfig()`
- `resetRuntimeConfigToDefault()`
- `validateRuntimeConfigInput()`

Data source precedence:
1. `localStorage` runtime overrides
2. env defaults (`NEXT_PUBLIC_API_BASE`, `NEXT_PUBLIC_WS_URL`)

Persisted runtime config shape (required):

```ts
type RuntimeConfig = {
  apiBase: string;
  wsUrl: string;
  version: 1;
};
```

Storage key (required):
- `ai-emotion::runtime-config::v1`

Validation/error contracts (required):

```ts
type RuntimeConfigValidationError = {
  field: "apiBase" | "wsUrl";
  code: "invalid_scheme" | "empty_value";
  message: string;
};

type RuntimeConfigLoadResult = {
  config: RuntimeConfig;
  source: "local_storage" | "env_default";
  warningCode?:
    | "storage_unavailable"
    | "invalid_json"
    | "invalid_shape"
    | "version_mismatch"
    | "invalid_env_default";
};

type RuntimeConfigActionResult = {
  ok: boolean;
  config: RuntimeConfig;
  errorCode?: "storage_write_failed" | "validation_failed";
  errors?: RuntimeConfigValidationError[];
};
```

Deterministic degraded behavior (required):
- If `localStorage` is unavailable, load env default config and set `warningCode = "storage_unavailable"`.
- If persisted JSON parse fails, ignore persisted value, load env defaults, and set `warningCode = "invalid_json"`.
- If persisted JSON parses but does not match `RuntimeConfig` shape, ignore persisted value, load env defaults, and set `warningCode = "invalid_shape"`.
- If persisted `version` mismatches, ignore persisted value, load env defaults, and set `warningCode = "version_mismatch"`.
- If env defaults are missing/invalid, fall back to hardcoded safe defaults (`http://127.0.0.1:8000`, `ws://127.0.0.1:8000/ws/events`) and set `warningCode = "invalid_env_default"`.
- Save operation returns a typed error for storage failure; UI surfaces non-blocking feedback and keeps in-memory form values.
- All loaded configs (from storage/env/hardcoded) must pass the same URL scheme validation; invalid values are never returned as effective runtime config.

## 7. Interaction and Data Flow

### 7.1 Language

- Continue using `DashboardI18nProvider` + `LOCALE_STORAGE_KEY`.
- Mount i18n provider through a client-only provider wrapper inside server layout so layout metadata/SSR boundary is preserved.
- Locale updates on Settings page reflect immediately when returning to Console.
- Navigation tab labels are localized via i18n keys (not hardcoded Chinese-only text).

### 7.2 Endpoint Editing

Settings endpoint form fields:
- `API_BASE`
- `WS_URL`

Actions:
- Save: validate and persist to `localStorage`.
- Reset default: clear override and revert to env defaults.
- Save/Reset success immediately updates Settings page runtime config state.
- Provider section receives updated `apiBase` in the same render commit.

Validation rules:
- `API_BASE` must start with `http://` or `https://`
- `WS_URL` must start with `ws://` or `wss://`

Provider rebinding timing contract:
- On endpoint save/reset, `SettingsProviderSection` remounts with new `apiBase` before any new provider action can fire.
- `SettingsPage` increments `apiBaseRevision` on successful save/reset, and `SettingsProviderSection` remounts `ProviderManager` using `key={apiBaseRevision}`.
- Provider actions do not require additional cross-component load-ready handshake; `ProviderManager` keeps owning its internal busy/disabled states.
- Existing in-flight provider request responses from prior revision are dropped because they target an unmounted `ProviderManager` instance and are not allowed to update current revision UI state.

### 7.3 Console Runtime Binding

Console route reads runtime config on mount and uses it for:
- HTTP requests (`postJson`)
- WebSocket stream (`useEventStream`)

After endpoint edits, next navigation to Console uses latest saved values.
If Console is already mounted during endpoint changes elsewhere, it does not hot-rebind in place; new endpoints apply on the next Console mount (route re-entry or page reload).

### 7.4 Provider Management

Settings route passes effective `apiBase` to `ProviderManager`.
Provider behavior remains full-featured:
- list
- create
- update
- activate
- test
- delete

## 8. Error Handling

- Endpoint validation errors: inline field-level message, no persistence on invalid input.
- `localStorage` failure: show non-blocking save failure message.
- Runtime config load warnings (`storage_unavailable`, `invalid_json`, `invalid_shape`, `version_mismatch`, `invalid_env_default`) are all surfaced with the same informational banner style.
- "One-time informational banner" means: once per page session per warning code (dedupe by `sessionStorage` key), not once per mount.
- Warning banner visibility contract:
  - `warningCode` comes from `loadRuntimeConfig()` result.
  - `dismissedWarningCodes` is session-scoped state owned by `SettingsPage`.
  - `SettingsEndpointSection` renders banner only when `warningCode` exists and is not dismissed in session state.
- Console connection/control failures: continue using existing ControlRail error surface.
- Provider API failures: continue using existing `ProviderManager` error rendering.

## 9. Testing Plan

### 9.1 Unit

- `client/lib/config.ts`
  - default fallback behavior
  - override load/save behavior
  - validation and reset behavior
  - degraded read-path behavior (`storage_unavailable`, `invalid_json`, `version_mismatch`)
  - degraded read-path behavior (`invalid_shape`, `invalid_env_default`)
  - typed validation error outputs
  - load-path schema validation for parsed storage payload and env defaults

### 9.2 Component

- Navigation tabs render and active state by route.
- Settings page sections render (language/endpoint/provider).
- Endpoint save persists and rehydrates on revisit.
- Console tests updated to assert no config controls are rendered there.
- Endpoint save/reset triggers provider section rebind with latest `apiBase`.
- Storage write failure shows non-blocking inline error in endpoint section.
- Invalid persisted payload falls back to default config and displays warning banner.
- Stale provider responses from prior `apiBaseRevision` do not mutate current section UI.

### 9.3 Integration

- End-to-end route behavior:
  - edit endpoints in `/settings` and save
  - verify `ProviderManager` uses new `apiBase`
  - navigate to `/` and verify console uses the same new endpoints

### 9.4 Regression Gate

Run in `client`:
- `npm run lint`
- `npm run test:unit`
- `npm run build`

## 10. Acceptance Criteria

- Visiting `/` shows runtime console only; no configuration controls.
- Visiting `/settings` allows language + endpoint + full provider management.
- Top tabs switch between Console and Settings and reflect active route.
- Top tab labels are localized according to selected locale.
- Locale persists across refresh and applies to both routes.
- Endpoint overrides persist locally and are consumed by Console.
- Endpoint update in `/settings` is immediately consumed by Provider section in the same page session.
- Existing console runtime behavior remains intact.
