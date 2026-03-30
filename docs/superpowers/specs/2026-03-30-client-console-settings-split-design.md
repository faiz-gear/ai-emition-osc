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
- Provide top tab navigation (`控制台 | 配置`) with clear active state.
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

- Add shared top tabs: `控制台 | 配置`.
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

## 6. Runtime Config Data Model (Frontend-Only)

Add runtime config helpers in `client/lib/config.ts`:
- `loadRuntimeConfig()`
- `saveRuntimeConfig()`
- `resetRuntimeConfigToDefault()`

Data source precedence:
1. `localStorage` runtime overrides
2. env defaults (`NEXT_PUBLIC_API_BASE`, `NEXT_PUBLIC_WS_URL`)

Suggested persisted shape:

```ts
type RuntimeConfig = {
  apiBase: string;
  wsUrl: string;
  version: 1;
};
```

Suggested storage key:
- `ai-emotion::runtime-config::v1`

## 7. Interaction and Data Flow

### 7.1 Language

- Continue using `DashboardI18nProvider` + `LOCALE_STORAGE_KEY`.
- Move i18n provider to app-level layout so both routes share locale state.
- Locale updates on Settings page reflect immediately when returning to Console.

### 7.2 Endpoint Editing

Settings endpoint form fields:
- `API_BASE`
- `WS_URL`

Actions:
- Save: validate and persist to `localStorage`.
- Reset default: clear override and revert to env defaults.

Validation rules:
- `API_BASE` must start with `http://` or `https://`
- `WS_URL` must start with `ws://` or `wss://`

### 7.3 Console Runtime Binding

Console route reads runtime config on mount and uses it for:
- HTTP requests (`postJson`)
- WebSocket stream (`useEventStream`)

After endpoint edits, next navigation to Console uses latest saved values.

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
- Console connection/control failures: continue using existing ControlRail error surface.
- Provider API failures: continue using existing `ProviderManager` error rendering.

## 9. Testing Plan

### 9.1 Unit

- `client/lib/config.ts`
  - default fallback behavior
  - override load/save behavior
  - validation and reset behavior

### 9.2 Component

- Navigation tabs render and active state by route.
- Settings page sections render (language/endpoint/provider).
- Endpoint save persists and rehydrates on revisit.
- Console tests updated to assert no config controls are rendered there.

### 9.3 Regression Gate

Run in `client`:
- `npm run lint`
- `npm run test:unit`
- `npm run build`

## 10. Acceptance Criteria

- Visiting `/` shows runtime console only; no configuration controls.
- Visiting `/settings` allows language + endpoint + full provider management.
- Top tabs switch between Console and Settings and reflect active route.
- Locale persists across refresh and applies to both routes.
- Endpoint overrides persist locally and are consumed by Console.
- Existing console runtime behavior remains intact.
