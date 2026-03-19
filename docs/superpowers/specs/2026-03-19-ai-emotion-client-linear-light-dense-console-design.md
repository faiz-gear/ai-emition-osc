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
- Optional mode/status chips

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

### 4.4 Bottom-left `UtteranceStream`
Contains:
- Reverse-chronological utterance list
- Status token per utterance (`queued`, `processing`, `done`, `dropped`, `error`)
- Dominant emotion and latency snapshot

Purpose:
- Fast historical drill-down while preserving realtime context.

### 4.5 Bottom-right `EmotionDetail`
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
- Primary UI font: modern clean sans (non-default stack; implementation to use web font)
- Numeric/time font: monospace for precision-oriented scanning
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

### 6.2 Live Transcript Behavior
- When processing/partial text exists, apply shimmer sweep effect.
- Effect style:
  - Text rendered with animated gradient sweep
  - Moderate speed (around 1.8-2.2s loop)
  - High readability preserved (no low-contrast flicker)
- When final text lands, remove shimmer and render stable text.

### 6.3 Follow-Latest Toggle
- Add "Follow latest utterance" toggle, default ON.
- Manual row selection sets toggle OFF automatically.
- Re-enabling toggle jumps to newest utterance.

### 6.4 Provider Panel Behavior
- Default collapsed as `Advanced`.
- Expansion state persisted locally (`localStorage`).

### 6.5 Error Display
- Compact last-error surface in ControlRail.
- Dismiss action clears UI presentation only (no backend mutation).

## 7. Component Boundaries and Responsibilities

All boundaries are UI-only and consume existing data contracts.

- `DashboardShell`
  - Layout orchestration and responsive grid regions.
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
- Data derivation stays in page container/state layer.
- Presentational components receive shaped props and remain stateless where possible.

## 8. Data Flow

Existing event flow is retained:
- WebSocket events -> reducer -> derived selected utterance/emotion -> UI regions
- API commands for start/stop/provider actions remain unchanged

Enhancements:
- Add local UI state for:
  - Follow-latest toggle
  - Provider panel expanded state
  - Dismissed error visibility

No backend schema or endpoint changes are required.

## 9. Error Handling and Edge Cases

- WS disconnected: control rail shows clear disconnected state.
- No utterances: show concise empty state in stream and emotion detail.
- Partial text stale: live timestamp helps detect stale flow.
- Provider panel errors: keep existing inline error style, aligned to new token set.
- Extremely long transcript lines: clamp with expandable overflow behavior.
- Mobile narrow widths: stack to single column with ControlRail still first.

## 10. Responsive Strategy

- Desktop: 2-column command console layout (hero + ops + stream/detail split)
- Tablet: shrink dense cards and reduce side-by-side width ratios
- Mobile: linearized sections in priority order:
  1. ControlRail
  2. LiveTranscriptStage
  3. RealtimeOpsStack
  4. UtteranceStream
  5. EmotionDetail
  6. ProviderAdvancedPanel

## 11. Testing Strategy

### Unit/Component
- Reducer behavior unchanged for event updates.
- Follow-latest toggle transitions.
- Provider panel collapse state persistence.
- Live transcript effect class toggling based on processing state.

### Integration/UI
- Start/Stop actions update badges and button states correctly.
- Selecting utterance updates emotion detail panel.
- Last-error dismiss affects UI only.
- Dense layout remains readable under realistic data volume.

### Manual Visual QA
- Verify Linear-like light tone consistency across sections.
- Verify compact spacing and typography hierarchy.
- Verify shimmer effect readability and non-distracting motion.
- Verify mobile usability for all critical controls.

## 12. Acceptance Criteria

- Hero area is clearly Start/Stop + live transcript.
- Theme is Linear-like light (not dark, not blue-heavy).
- High-density layout is scannable and stable.
- Processing transcript uses shimmer sweep effect.
- Provider Manager is default-collapsed into Advanced.
- Key health states are discoverable within one second.
- Page works on desktop and mobile breakpoints.

## 13. Out of Scope (Explicit)

- Backend or protocol redesign
- Provider-domain feature expansion
- New analytics/reporting modules
- Multi-page IA overhaul

