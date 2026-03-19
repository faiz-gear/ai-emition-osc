# AI Emotion Client Redesign (Linear Light Dense Console)

Date: 2026-03-19  
Scope: `/client` frontend redesign only (no backend API changes)

## 1. Context

Current dashboard is functionally complete but visually resembles an engineering demo board.  
The target is a professional AI SaaS realtime debugging console for technical users.

Confirmed direction:
- Primary user: technical/developer team
- Primary job: realtime debugging console
- Hero area: Start/Stop + live transcript
- Scope: visual redesign + light interaction improvements
- Theme: Linear-like light theme
- Density: compact/high-density
- Live transcript processing effect: shimmer sweep (Codex-like)

## 2. Goals and Non-Goals

### Goals
- Make the first screen immediately actionable for realtime debugging.
- Establish a polished, consistent light design system aligned with Linear-like tone.
- Increase information density while preserving scannability.
- Keep all existing capabilities available with clearer hierarchy.

### Non-Goals
- No backend API contract changes.
- No new business domains (auth, tenancy, billing, reports center).
- No heavy feature expansion beyond lightweight UX improvements.

## 3. Chosen Product/UX Approach

Chosen approach: **A. Command Console**, with selective high-density metric layout.

Rationale:
- Fastest path from "open page" to "operate and debug".
- Strong focus on live state and active audio/emotion pipeline.
- Minimizes cognitive switching for technical workflows.

## 4. Information Architecture

### 4.1 Top `ControlRail` (sticky)
Contains:
- Start/Stop primary controls
- Connection state
- Listening state
- Compact last-error slot
- Only currently implemented status chips (no new chip types in this scope)

Purpose:
- Keep mission-critical controls visible at all times.

### 4.2 Center `LiveTranscriptStage` (hero)
Contains:
- Realtime subtitle text as the primary visual focus
- Live indicator + last update timestamp
- Processing-state shimmer sweep text effect

Purpose:
- Make active speech pipeline state obvious in under one second.

### 4.3 Right `RealtimeOpsStack` (dense metrics)
Contains compact cards:
- Latency
- Queue depth
- Throughput totals
- Errors
- WS clients
- Uptime

Purpose:
- Keep operational health adjacent to primary workflow.

### 4.4 Bottom-left `UtteranceStreamPanel`
Contains:
- Reverse-chronological utterance list
- Status token per utterance (`queued`, `processing`, `done`, `dropped`, `error`)
- Dominant emotion and latency snapshot

Purpose:
- Fast historical drill-down while preserving realtime context.

### 4.5 Bottom-right `EmotionDetailPanel`
Contains:
- Existing radar visualization
- Dominant emotion
- Explanation text
- Selected utterance metadata

Purpose:
- Detailed inspection panel for selected events.

### 4.6 `ProviderAdvancedPanel`
Contains:
- Existing provider manager controls
- Default collapsed
- Local persistence of expand/collapse state

Purpose:
- Preserve advanced controls without polluting primary debug flow.

## 5. Visual Design System (Linear-like Light, Compact)

## 5.1 Color Tokens (proposed)
- `--bg`: `#f7f7f8`
- `--surface`: `#ffffff`
- `--surface-muted`: `#fbfbfc`
- `--border`: `#e6e8eb`
- `--text-primary`: `#111318`
- `--text-secondary`: `#5f6470`
- `--accent`: `#5e6ad2`
- `--success`: `#1f9d55`
- `--warning`: `#b7791f`
- `--danger`: `#c53030`

Usage rules:
- Neutral palette dominates.
- Accent colors reserved for interaction and state, not decoration.

## 5.2 Typography
- Primary UI font: `Manrope` (weights 500/600/700), loaded with `next/font/google` at layout level.
- Sans fallback stack: `"Manrope", "SF Pro Text", "Segoe UI", "Helvetica Neue", sans-serif`
- Numeric/time font: `JetBrains Mono` for precision-oriented scanning.
- Mono fallback stack: `"JetBrains Mono", "SF Mono", "Menlo", "Consolas", monospace`
- Compact scale:
  - Labels: 11-12px
  - Body: 13-14px
  - Key metrics: 18-22px

## 5.3 Spacing and Shape
- Density scale: `4 / 8 / 12 / 16`
- Radius: `10-12px`
- Border-first layering: 1px borders, subtle shadows, minimal blur/glow

## 5.4 Motion
- Initial staged fade-in only (short and subtle)
- State transitions via color/border interpolation
- No decorative movement unrelated to state changes

## 6. Interaction Specification

### 6.1 Primary Controls
- `Start` is primary emphasis.
- `Stop` is secondary.
- Controls remain visible while scrolling.
- Failure behavior:
  - If Start/Stop request fails, keep current listening state unchanged.
  - Surface failure message in ControlRail error slot immediately.
  - Re-enable buttons after request settles so user can retry manually.
  - Request timeout: cancel after `10s` via `AbortController`; treat as failure and show timeout message.

### 6.2 Live Transcript Behavior
- When processing/partial text exists, apply shimmer sweep effect.
- Effect style:
  - Text rendered with animated gradient sweep
  - Moderate speed (around 1.8-2.2s loop)
  - High readability preserved (no low-contrast flicker)
- When final text lands, remove shimmer and render stable text.
- Freshness label rule (based on `Date.now() - lastPartialOrFinalUpdateMs`):
  - `LIVE` when delta `< 2000ms`
  - `IDLE` when delta `2000-8000ms`
  - `STALE` when delta `> 8000ms`

### 6.3 Follow-Latest Toggle
- Add "Follow latest utterance" toggle, default ON.
- Manual row selection sets toggle OFF automatically.
- Re-enabling toggle jumps to newest utterance.

### 6.4 Provider Panel Behavior
- Default collapsed as `Advanced`.
- Expansion state persisted locally (`localStorage`).
- Next.js client safety:
  - Access `localStorage` only after client mount (`useEffect`).
  - Wrap read/write in `try/catch`; fallback to default collapsed on failure.
  - Persistence key: `ai-emotion::dashboard::provider-panel-open::v1`

### 6.5 Error Display
- Compact last-error surface in ControlRail.
- Dismiss action clears UI presentation only (no backend mutation).
- Lifecycle:
  - `new_error` means either:
    - an incoming `error` event was received, or
    - a local control request failed (`Start`/`Stop` timeout or non-2xx).
  - `new_error` always re-shows the slot even if previously dismissed.
  - `dismiss` hides current message in memory only for current page session.
  - `reconnect` does not auto-clear existing visible message.
  - `refresh` resets dismissal state and shows latest server-provided error.

## 7. Component Boundaries and Responsibilities

All boundaries are UI-only and consume existing data contracts.

- `DashboardPageContainer`
  - Single owner of business/application state for reducer + derived view-model + cross-region callbacks.
- `DashboardShell`
  - Stateless layout component composed by `DashboardPageContainer`.
  - Owns only visual region composition and responsive grid regions.
- `ControlRail`
  - Top controls, connection/listening badges, last-error slot.
- `LiveTranscriptStage`
  - Hero subtitle rendering, shimmer logic, live timestamp.
- `RealtimeOpsStack`
  - Dense metric card rendering and formatting.
- `UtteranceStreamPanel`
  - List rendering, selection, follow-latest toggle behavior.
- `EmotionDetailPanel`
  - Radar + explanation + selected context.
- `ProviderAdvancedPanel`
  - Collapsible wrapper around existing provider management UI.

Boundary rule:
- Data derivation and business state stay in `DashboardPageContainer`.
- Region components can own local UI-only state (open/close, scroll anchor, local sheet visibility) but not business state.
- Presentational components receive shaped props and remain stateless where possible.

### 7.1 Interface/Ownership Contract

| Component | Inputs | Emits/Callbacks | Owns Local State | Test Responsibility |
|---|---|---|---|---|
| `DashboardPageContainer` | WS event stream, API responses | `onStart`, `onStop`, `onSelectUtterance`, `onToggleFollow`, `onDismissError` | `selectedId`, `followLatest`, `isProviderPanelOpen`, `dismissedErrorKey`, `errorVersion` | Reducer transitions, derived selection logic, ownership rules |
| `ControlRail` | connection/listening status, visible error text | `onStart`, `onStop`, `onDismissError` | `isErrorSheetOpen` (mobile only) | Control disabled/enabled states, error slot, mobile sheet behavior |
| `LiveTranscriptStage` | `currentPartial`, `lastUpdateAt`, `isProcessing` | none | none | Shimmer class toggle and timestamp freshness label |
| `RealtimeOpsStack` | formatted metrics | none | none | Token and value rendering stability |
| `UtteranceStreamPanel` | utterance list, `selectedId`, `followLatest` | `onSelect`, `onToggleFollow` | local scroll anchoring only | Selection and follow toggle behavior |
| `EmotionDetailPanel` | selected utterance + emotion | none | none | Empty/selected rendering branches |
| `ProviderAdvancedPanel` | provider data + open flag | `onToggleOpen` and provider actions passthrough | none | Collapse/expand and persistence integration |

Relationship contract:
- `DashboardPageContainer` -> computes all view-model props -> passes into `DashboardShell`.
- `DashboardShell` -> places regions (`ControlRail`, `LiveTranscriptStage`, `RealtimeOpsStack`, `UtteranceStreamPanel`, `EmotionDetailPanel`, `ProviderAdvancedPanel`) without owning business state.

### 7.2 Data Contract Mapping (Ops + Status)

| UI Item | Source Field | Transform | Unit | Empty/Fallback |
|---|---|---|---|---|
| Latency | `metrics.avg_emotion_latency_ms` | `Math.round(value)` | `ms` | `-` |
| Queue Depth | `metrics.emotion_queue_depth` | integer display | `count` | `0` |
| Throughput (Utterances) | `metrics.utterances_total` | integer display | `count` | `0` |
| Throughput (Emotion) | `metrics.emotion_total` | integer display | `count` | `0` |
| Errors | `metrics.errors_total` | integer display | `count` | `0` |
| WS Clients | `metrics.ws_clients` | integer display | `count` | `0` |
| Uptime | `metrics.uptime_seconds` | round to integer | `sec` | `-` |
| Connection Chip | `connectionState` | enum mapping | `Connected/Connecting/Disconnected` | `Disconnected` |
| Listening Chip | `viewModel.listening` (derived from `status?.status.listening ?? false`) | boolean mapping | `Listening/Stopped` | `Stopped` |

### 7.3 Provider Action Callback Contract

| Callback | Params | Returns | Loading/Error Ownership |
|---|---|---|---|
| `onRefreshProviders` | none | `Promise<void>` | `ProviderAdvancedPanel` shows local loading and inline error text |
| `onActivateProvider` | `{ id: string }` | `Promise<void>` | `ProviderAdvancedPanel` owns per-row busy state and error surface |
| `onTestProvider` | `{ id: string }` | `Promise<void>` | `ProviderAdvancedPanel` owns per-row busy state and result/info message |
| `onDeleteProvider` | `{ id: string }` | `Promise<void>` | `ProviderAdvancedPanel` owns per-row busy state and error surface |
| `onCreateProvider` | `{ payload: CreateProviderRequest }` | `Promise<void>` | `ProviderAdvancedPanel` owns submit loading and form error surface |
| `onUpdateProvider` | `{ id: string; payload: PatchProviderRequest }` | `Promise<void>` | `ProviderAdvancedPanel` owns submit loading and form error surface |

## 8. Data Flow

Existing event flow is retained:
- WebSocket events -> reducer -> derived selected utterance/emotion -> UI regions
- API commands for start/stop/provider actions remain unchanged

Enhancements and ownership mapping:
- `selectedId`:
  - Owner: `DashboardPageContainer`
  - Rule: defaults to newest utterance id when `followLatest = true`.
- `followLatest`:
  - Owner: `DashboardPageContainer`
  - Rule: default `true`; set `false` on manual row selection.
- `isProviderPanelOpen`:
  - Owner: `DashboardPageContainer` with localStorage persistence.
- `dismissedErrorKey`:
  - Owner: `DashboardPageContainer`
  - Rule: computed from latest error payload signature; cleared when signature changes.
- `errorVersion`:
  - Owner: `DashboardPageContainer`
  - Rule: increments on each `new_error` transition regardless of message text.

Error signature formula:
- Current contract uses `error.message` only, so:
  - `errorSignature = [(errorMessage || "").trim() || "unknown-error", errorVersion].join("|")`
  - Empty message fallback: `"unknown-error"`

Persistence execution rule:
- Read persisted values after mount only.
- On read/write exception (private mode/quota), continue with in-memory state and no crash.
- Applies to provider panel open-state only.
- Error dismiss state is intentionally not persisted across refreshes.

Error source matrix (`new_error` trigger):
- WS `error` event with `message` -> increment `errorVersion`, show slot.
- `status`/`snapshot` payload with `last_error` changed -> increment `errorVersion`, show slot.
- Local Start/Stop failure (network timeout/non-2xx) -> increment `errorVersion`, show slot.

Selection sync rules:
- If selected utterance no longer exists:
  - when `followLatest = true`, fallback to newest item.
  - when `followLatest = false`, set selected utterance to `null` and keep user in manual mode.
- If list is empty, selected utterance becomes `null` and detail panel shows empty state.

Deterministic sorting rule:
- Primary: `started_at` descending (valid timestamp first)
- Secondary: `ended_at` descending
- Tertiary: `id` descending lexical
- Missing/invalid timestamps are treated as lowest priority and sorted last.

No backend schema or endpoint changes are required.

## 9. Error Handling and Edge Cases

- WS disconnected: control rail shows clear disconnected state.
- No utterances: show concise empty state in stream and emotion detail.
- Partial text stale: live timestamp helps detect stale flow.
- Provider panel errors: keep existing inline error style, aligned to new token set.
- Extremely long transcript lines: clamp with expandable overflow behavior.
- Transcript overflow contract:
  - default clamp: 2 lines in list rows, 3 lines in live transcript stage.
  - show `Expand` action when overflow is detected.
  - expanded content is per-item local UI state; `Collapse` restores clamp.
- Out-of-order WS updates: list ordering always derived from `started_at` descending on render.
- Selected utterance removed/replaced by snapshot: fallback to newest utterance or null.
- Rapid Start/Stop toggles: buttons remain mutually disabled while pending request is in flight.
- Start/Stop response race rule:
  - `DashboardPageContainer` assigns increasing `commandSeq` per Start/Stop request.
  - responses with stale `commandSeq` are ignored and cannot overwrite newer listening state.
- Duplicate partial events: latest text replaces prior partial for same utterance id.
- Mobile narrow widths: stack to single column with ControlRail still first.
- Start/Stop network stall: timeout at 10s, surface error, and unlock controls for retry.

## 10. Responsive Strategy

Breakpoints:
- `mobile`: `< 768px`
- `tablet`: `768px - 1279px`
- `desktop`: `>= 1280px`

Layout rules by region:
- `ControlRail`:
  - mobile/tablet/desktop: sticky top, full width.
  - mobile compaction rule: maintain single row with priority order:
    1) Start/Stop
    2) connection chip
    3) listening chip
    4) error indicator icon
  - low-priority text (full error message) moves to tap-to-expand sheet on mobile.
  - ownership: sheet open/close state is owned by `ControlRail` local UI state.
- `LiveTranscriptStage`:
  - mobile: full width block under ControlRail.
  - tablet/desktop: main-left priority area.
- `RealtimeOpsStack`:
  - mobile: 2-column dense cards under transcript.
  - tablet: 3-column dense cards.
  - desktop: right-side stack with 2-column internal card grid.
  - desktop sizing rule at `1280x800`: max region height `260px`, no vertical scrollbar, 6 core metrics visible as 3x2 grid.
- `UtteranceStreamPanel` + `EmotionDetailPanel`:
  - mobile: stream first, detail second.
  - tablet: stacked.
  - desktop: two-column split.
- `ProviderAdvancedPanel`:
  - all breakpoints: last region, collapsed by default.

## 11. Testing Strategy

### Unit/Component
- Reducer behavior unchanged for event updates.
- Follow-latest toggle transitions.
- Provider panel collapse state persistence.
- Live transcript effect class toggling based on processing state.
- Freshness label transition checks at `<2s`, `2-8s`, `>8s`.
- Error lifecycle transitions (`new_error`, `dismiss`, `refresh`).
- Error source matrix checks (`error` event, `status.last_error` change, local request failure).
- Selection fallback when selected item disappears.
- Start/Stop stale-response ignoring by `commandSeq`.

### Integration/UI
- Start/Stop actions update badges and button states correctly.
- Start/Stop failure shows error slot, keeps prior listening state, and allows retry.
- Selecting utterance updates emotion detail panel.
- Last-error dismiss affects UI only.
- Out-of-order event arrivals still render correct sorted order.
- Repeated identical error messages still reappear on new error event due to `errorVersion` increment.
- Transcript overflow expand/collapse behavior works for both mouse and keyboard activation.
- Dense layout remains readable under realistic data volume.
- Breakpoint layout checks at 375px, 768px, 1024px, 1280px.

### Manual Visual QA
- Verify Linear-like light tone consistency across sections.
- Verify compact spacing and typography hierarchy.
- Verify shimmer effect readability and non-distracting motion.
- Verify mobile usability for all critical controls.
- Verify mobile error sheet opens/closes correctly and does not break sticky rail.
- Verify shimmer respects `prefers-reduced-motion` by disabling sweep animation.

## 12. Acceptance Criteria

- Hero area has Start/Stop and live transcript visible above fold at `1280x800`.
- Theme tokens use light background (`--bg` near `#f7f7f8`) and neutral border palette; no dark page background is present.
- Realtime ops stack shows at least 6 core metrics without scrolling on `1280x800`.
- Processing transcript applies shimmer class only while partial/processing text is active.
- Transcript freshness badge follows `<2s` LIVE, `2-8s` IDLE, `>8s` STALE thresholds.
- Provider Manager renders collapsed by default on first load and restores prior user expansion state after reload.
- ControlRail stays sticky and single-row at 375px/768px/1280px widths; at 375px it uses compact priority mode with overflowed error details behind tap-to-expand.
- Layout passes visual checks at 375px, 768px, and 1280px widths without clipped primary controls.
- Start/Stop requests timeout at 10s and always return controls to interactive state.

## 13. Out of Scope (Explicit)

- Backend or protocol redesign
- Provider-domain feature expansion
- New analytics/reporting modules
- Multi-page IA overhaul
- New status-chip types beyond currently available backend states
