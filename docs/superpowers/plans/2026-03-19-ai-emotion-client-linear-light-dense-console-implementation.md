# AI Emotion Client Linear Light Dense Console Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/client` into a Linear-like light, high-density realtime debugging console while preserving current API contracts and core behaviors.

**Architecture:** Keep `client/app/page.tsx` as the business-state container and split UI into focused dashboard region components. Add deterministic state utilities (sorting, error lifecycle, command race/timeout handling), design tokens, and compact responsive layout rules. Use TDD-first unit/component tests for behavior-critical logic and finish with visual/responsive verification.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, Recharts, Vitest + React Testing Library.

---

## Scope Check

This is one frontend subsystem (`/client`) and can ship as a single plan without splitting into independent projects.

## Execution Skills

- `@test-driven-development`
- `@verification-before-completion`
- `@requesting-code-review`

## File Structure (Target)

- Create `client/vitest.config.ts`: unit test runner config (`jsdom`, alias support, setup file).
- Create `client/test/setup.ts`: test runtime setup (`@testing-library/jest-dom`).
- Modify `client/package.json`: add `test:unit`, `test:unit:watch`, and related dev dependencies.
- Create `client/lib/dashboard/types.ts`: dashboard-local view-model and UI state types.
- Create `client/lib/dashboard/utterance-utils.ts`: deterministic utterance upsert/sort/selection fallback helpers.
- Create `client/lib/dashboard/error-state.ts`: error signature, version, dismiss/re-show lifecycle helpers.
- Create `client/lib/dashboard/command-control.ts`: start/stop timeout + command sequence guard helpers.
- Create `client/lib/dashboard/__tests__/utterance-utils.test.ts`: sorting/selection unit tests.
- Create `client/lib/dashboard/__tests__/types-contract.test.ts`: dashboard contract constant tests.
- Create `client/lib/dashboard/__tests__/error-state.test.ts`: error lifecycle unit tests.
- Create `client/lib/dashboard/__tests__/command-control.test.ts`: timeout/sequence unit tests.
- Create `client/components/dashboard/DashboardShell.tsx`: stateless region layout composition.
- Create `client/components/dashboard/ControlRail.tsx`: sticky command rail, chips, error slot/sheet.
- Create `client/components/dashboard/LiveTranscriptStage.tsx`: hero transcript with shimmer and freshness badge.
- Create `client/components/dashboard/RealtimeOpsStack.tsx`: compact metric card stack.
- Create `client/components/dashboard/UtteranceStreamPanel.tsx`: utterance list + follow-latest toggle + expand/collapse text.
- Create `client/components/dashboard/EmotionDetailPanel.tsx`: selected utterance emotion detail panel.
- Create `client/components/dashboard/ProviderAdvancedPanel.tsx`: collapsible wrapper with provider callbacks.
- Create `client/components/dashboard/__tests__/ControlRail.test.tsx`: control rail behavior tests.
- Create `client/components/dashboard/__tests__/LiveTranscriptStage.test.tsx`: shimmer/freshness tests.
- Create `client/components/dashboard/__tests__/UtteranceStreamPanel.test.tsx`: follow-latest and expand/collapse tests.
- Modify `client/app/layout.tsx`: load `Manrope` + `JetBrains Mono` fonts and CSS variables.
- Modify `client/app/globals.css`: light theme tokens, density scales, shimmer animation, reduced-motion fallback.
- Modify `client/app/page.tsx`: compose new shell and connect reducer + dashboard-local state utilities.
- Modify `client/lib/types.ts`: only if needed for stricter local mapping (no API contract change).

## Chunk 1: Foundation, State Contracts, and Test Harness

### Task 1: Add Frontend Test Harness

**Files:**
- Create: `client/vitest.config.ts`
- Create: `client/test/setup.ts`
- Modify: `client/package.json`

- [ ] **Step 1: Add a failing smoke test command path**

Run: `cd client && npm run test:unit`  
Expected: FAIL with missing script `test:unit`.

- [ ] **Step 2: Add Vitest config + setup file**

```ts
// client/vitest.config.ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "jsdom", setupFiles: ["./test/setup.ts"], globals: true },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } }
});
```

```ts
// client/test/setup.ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Add scripts and dev dependencies**

```json
{
  "scripts": {
    "test:unit": "vitest run --passWithNoTests",
    "test:unit:watch": "vitest"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^16.0.0",
    "jsdom": "^25.0.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 4: Install dependencies**

Run: `cd client && npm install`  
Expected: PASS and local dependency tree updated.

- [ ] **Step 5: Verify harness boots**

Run: `cd client && npm run test:unit`  
Expected: PASS with `No test files found` (non-error exit after config is valid).

- [ ] **Step 6: Commit**

```bash
git add client/vitest.config.ts client/test/setup.ts client/package.json
git commit -m "test(client): add vitest and rtl harness"
```

### Task 2: Define Dashboard State Contracts

**Files:**
- Create: `client/lib/dashboard/types.ts`
- Create: `client/lib/dashboard/__tests__/types-contract.test.ts`

- [ ] **Step 1: Write failing contract usage test**

Create `client/lib/dashboard/__tests__/types-contract.test.ts` and assert required exports exist:

```ts
import { describe, expect, it } from "vitest";
import { FRESHNESS_THRESHOLDS_MS, PROVIDER_PANEL_STORAGE_KEY } from "../types";

describe("dashboard type contracts", () => {
  it("exports freshness thresholds and storage key constants", () => {
    expect(FRESHNESS_THRESHOLDS_MS.live).toBe(2000);
    expect(PROVIDER_PANEL_STORAGE_KEY).toBe("ai-emotion::dashboard::provider-panel-open::v1");
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

Run: `cd client && npm run test:unit -- client/lib/dashboard/__tests__/types-contract.test.ts`  
Expected: FAIL with missing `types` module exports.

- [ ] **Step 3: Implement dashboard contracts**

```ts
export const FRESHNESS_THRESHOLDS_MS = { live: 2000, stale: 8000 } as const;
export const PROVIDER_PANEL_STORAGE_KEY = "ai-emotion::dashboard::provider-panel-open::v1";
export type Freshness = "LIVE" | "IDLE" | "STALE";
export type ErrorSource = "ws_error_event" | "status_last_error" | "control_failure";
```

- [ ] **Step 4: Re-run tests**

Run: `cd client && npm run test:unit -- client/lib/dashboard/__tests__/types-contract.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/lib/dashboard/types.ts client/lib/dashboard/__tests__/types-contract.test.ts
git commit -m "feat(client): add dashboard local contract types and constants"
```

### Task 3: Implement Deterministic Utterance Utilities (TDD)

**Files:**
- Create: `client/lib/dashboard/utterance-utils.ts`
- Create: `client/lib/dashboard/__tests__/utterance-utils.test.ts`

- [ ] **Step 1: Write failing tests for sort/upsert/fallback rules**

```ts
import { describe, expect, it } from "vitest";
import { normalizeAndSortUtterances, pickSelectedUtteranceId, upsertUtterance } from "../utterance-utils";

describe("utterance-utils", () => {
  it("sorts by started_at desc with ended_at/id tiebreakers", () => {
    const sorted = normalizeAndSortUtterances([
      { id: "a", started_at: "2026-03-19T10:00:00Z", emotion_status: "queued" },
      { id: "b", started_at: "2026-03-19T10:00:00Z", ended_at: "2026-03-19T10:00:01Z", emotion_status: "queued" }
    ]);
    expect(sorted[0].id).toBe("b");
  });

  it("sorts invalid timestamps last", () => {
    const sorted = normalizeAndSortUtterances([
      { id: "z", started_at: "INVALID_DATE", emotion_status: "queued" },
      { id: "a", started_at: "2026-03-19T10:00:00Z", emotion_status: "queued" }
    ]);
    expect(sorted.at(-1)?.id).toBe("z");
  });

  it("uses id descending as final tiebreak", () => {
    const sorted = normalizeAndSortUtterances([
      { id: "a", started_at: "2026-03-19T10:00:00Z", ended_at: "2026-03-19T10:00:00Z", emotion_status: "queued" },
      { id: "b", started_at: "2026-03-19T10:00:00Z", ended_at: "2026-03-19T10:00:00Z", emotion_status: "queued" }
    ]);
    expect(sorted[0].id).toBe("b");
  });

  it("supports upsert update by id", () => {
    const next = upsertUtterance([{ id: "u-1", started_at: "2026-03-19T10:00:00Z", emotion_status: "queued" }], { id: "u-1", emotion_status: "done" });
    expect(next[0].emotion_status).toBe("done");
  });

  it("falls back to latest when followLatest is true", () => {
    const nextId = pickSelectedUtteranceId({ previousSelectedId: "u-1", followLatest: true, utteranceIds: ["u-2", "u-3"] });
    expect(nextId).toBe("u-2");
  });

  it("drops to null when selected item disappears and followLatest is false", () => {
    const nextId = pickSelectedUtteranceId({ previousSelectedId: "u-1", followLatest: false, utteranceIds: ["u-2", "u-3"] });
    expect(nextId).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `cd client && npm run test:unit -- client/lib/dashboard/__tests__/utterance-utils.test.ts`  
Expected: FAIL with missing module exports.

- [ ] **Step 3: Implement utility functions**

```ts
import type { Utterance } from "@/lib/types";

type PickSelectedInput = {
  previousSelectedId: string | null;
  followLatest: boolean;
  utteranceIds: string[];
};

function parseTs(value?: string | null): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? Number.NEGATIVE_INFINITY : ts;
}

function compareUtteranceDesc(a: Utterance, b: Utterance): number {
  const started = parseTs(b.started_at) - parseTs(a.started_at);
  if (started !== 0) return started;
  const ended = parseTs(b.ended_at ?? null) - parseTs(a.ended_at ?? null);
  if (ended !== 0) return ended;
  return b.id.localeCompare(a.id);
}

export function upsertUtterance(list: Utterance[], patch: Partial<Utterance> & { id: string }): Utterance[] {
  const idx = list.findIndex((u) => u.id === patch.id);
  if (idx === -1) {
    return [{ id: patch.id, started_at: patch.started_at ?? "1970-01-01T00:00:00.000Z", emotion_status: patch.emotion_status ?? "queued", ...patch }, ...list];
  }
  const next = [...list];
  next[idx] = { ...next[idx], ...patch };
  return next;
}
export function normalizeAndSortUtterances(items: Utterance[]): Utterance[] {
  return [...items].sort(compareUtteranceDesc);
}
export function pickSelectedUtteranceId(input: PickSelectedInput): string | null {
  if (input.previousSelectedId && input.utteranceIds.includes(input.previousSelectedId)) return input.previousSelectedId;
  return input.followLatest ? input.utteranceIds[0] ?? null : null;
}
```

- [ ] **Step 4: Re-run unit tests**

Run: `cd client && npm run test:unit -- client/lib/dashboard/__tests__/utterance-utils.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/lib/dashboard/utterance-utils.ts client/lib/dashboard/__tests__/utterance-utils.test.ts
git commit -m "feat(client): add deterministic utterance sorting upsert and selection helpers"
```

### Task 4: Implement Error Lifecycle + Command Guard Utilities (TDD)

**Files:**
- Create: `client/lib/dashboard/error-state.ts`
- Create: `client/lib/dashboard/command-control.ts`
- Create: `client/lib/dashboard/__tests__/error-state.test.ts`
- Create: `client/lib/dashboard/__tests__/command-control.test.ts`

- [ ] **Step 1: Write failing error lifecycle matrix tests (`error-state.test.ts`)**

```ts
import { describe, expect, it } from "vitest";
import { applyErrorEvent, applyRefresh, deriveErrorVisibility, dismissError } from "../error-state";

it("treats status_last_error changes as new_error", () => {
  const state = applyErrorEvent({ current: null, source: "status_last_error", message: "backend timeout" });
  expect(state.errorVersion).toBe(1);
  expect(state.visible).toBe(true);
});

it("re-shows identical message when version increments", () => {
  const first = applyErrorEvent({ current: null, source: "ws_error_event", message: "timeout" });
  const dismissed = dismissError(first.visibleKey!);
  const second = applyErrorEvent({ current: { ...first, dismissedKey: dismissed }, source: "ws_error_event", message: "timeout" });
  expect(second.visible).toBe(true);
});

it("dismiss hides current error until refresh or new version", () => {
  const first = applyErrorEvent({ current: null, source: "control_failure", message: "timeout" });
  const dismissed = dismissError(first.visibleKey!);
  const hidden = deriveErrorVisibility({ message: "timeout", errorVersion: first.errorVersion, dismissedKey: dismissed });
  expect(hidden.visible).toBe(false);
});

it("refresh clears dismissal and shows latest status error", () => {
  const refreshed = applyRefresh({ message: "backend timeout" });
  expect(refreshed.visible).toBe(true);
});
```

- [ ] **Step 2: Write failing timeout/sequence tests (`command-control.test.ts`)**

```ts
import { describe, expect, it } from "vitest";
import { createCommandTracker, withCommandTimeout } from "../command-control";

it("aborts command after timeout", async () => {
  await expect(withCommandTimeout(async (_signal) => new Promise(() => {}), 5)).rejects.toThrow(/aborted|timeout/i);
});

it("ignores stale command response by sequence id", () => {
  const tracker = createCommandTracker();
  const seq1 = tracker.next();
  const seq2 = tracker.next();
  expect(tracker.isLatest(seq1)).toBe(false);
  expect(tracker.isLatest(seq2)).toBe(true);
});
```

- [ ] **Step 3: Run tests to verify failure**

Run: `cd client && npm run test:unit -- client/lib/dashboard/__tests__/error-state.test.ts client/lib/dashboard/__tests__/command-control.test.ts`  
Expected: FAIL with missing modules.

- [ ] **Step 4: Implement `error-state.ts`**

```ts
// client/lib/dashboard/error-state.ts
import type { ErrorSource } from "./types";
export type ErrorState = {
  errorVersion: number;
  message: string;
  visible: boolean;
  visibleKey: string;
  dismissedKey: string | null;
  source: ErrorSource;
};
export type ApplyErrorEventInput = {
  current: ErrorState | null;
  source: ErrorSource;
  message: string | null;
};

export function buildErrorSignature(message: string | null, version: number): string {
  return `${(message ?? "").trim() || "unknown-error"}|${version}`;
}
export function deriveErrorVisibility(input: { message: string | null; errorVersion: number; dismissedKey: string | null }) {
  const visibleKey = buildErrorSignature(input.message, input.errorVersion);
  return { visible: input.dismissedKey !== visibleKey, visibleKey };
}
export function applyErrorEvent(input: ApplyErrorEventInput): ErrorState {
  const nextVersion = (input.current?.errorVersion ?? 0) + 1;
  const nextMessage = (input.message ?? "").trim() || "unknown-error";
  const visibleKey = buildErrorSignature(nextMessage, nextVersion);
  return { errorVersion: nextVersion, message: nextMessage, visible: true, visibleKey, dismissedKey: null, source: input.source };
}
export function applyRefresh(input: { message: string | null }): ErrorState {
  const nextMessage = (input.message ?? "").trim() || "unknown-error";
  return { errorVersion: 1, message: nextMessage, visible: true, visibleKey: buildErrorSignature(nextMessage, 1), dismissedKey: null, source: "status_last_error" };
}
export function dismissError(signature: string): string {
  return signature;
}
```

- [ ] **Step 5: Implement `command-control.ts`**

```ts
// client/lib/dashboard/command-control.ts
export function createCommandTracker() {
  let latest = 0;
  return {
    next() {
      latest += 1;
      return latest;
    },
    isLatest(seq: number) {
      return seq === latest;
    }
  };
}
export async function withCommandTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms = 10_000): Promise<T> {
  const controller = new AbortController();
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      controller.abort();
      reject(new Error("command timeout"));
    }, ms);
  });
  try {
    return await Promise.race([fn(controller.signal), timeoutPromise]);
  } catch (error) {
    throw error;
  }
}
```

- [ ] **Step 6: Re-run tests**

Run: `cd client && npm run test:unit -- client/lib/dashboard/__tests__/error-state.test.ts client/lib/dashboard/__tests__/command-control.test.ts`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add client/lib/dashboard/error-state.ts client/lib/dashboard/command-control.ts client/lib/dashboard/__tests__/error-state.test.ts client/lib/dashboard/__tests__/command-control.test.ts
git commit -m "feat(client): add error lifecycle matrix and start-stop command guards"
```

### Task 5: Add Linear-Light Tokens, Fonts, and Motion Baseline

**Files:**
- Modify: `client/app/layout.tsx`
- Modify: `client/app/globals.css`

- [ ] **Step 1: Capture pre-change build baseline**

Run: `cd client && npm run build`  
Expected: PASS baseline build before token/font changes.

- [ ] **Step 2: Implement font loading + CSS variables**

```ts
// layout.tsx (snippet)
import { JetBrains_Mono, Manrope } from "next/font/google";
const manrope = Manrope({ subsets: ["latin"], variable: "--font-ui" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });
// apply to body className: `${manrope.variable} ${jetbrainsMono.variable}`
```

```css
:root {
  --bg: #f7f7f8;
  --surface: #ffffff;
  --surface-muted: #fbfbfc;
  --border: #e6e8eb;
  --text-primary: #111318;
  --text-secondary: #5f6470;
  --accent: #5e6ad2;
  --success: #1f9d55;
  --warning: #b7791f;
  --danger: #c53030;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --radius-md: 10px;
  --radius-lg: 12px;
}
body {
  background: var(--bg);
  color: var(--text-primary);
  font-family: var(--font-ui), "SF Pro Text", "Segoe UI", "Helvetica Neue", sans-serif;
}
code, .mono {
  font-family: var(--font-mono), "SF Mono", "Menlo", "Consolas", monospace;
}
.transcript-shimmer {
  background: linear-gradient(110deg, var(--text-primary) 0%, var(--text-primary) 42%, #6b7280 50%, var(--text-primary) 58%, var(--text-primary) 100%);
  background-size: 220% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: transcriptSweep 2s linear infinite;
}
.dashboard-enter {
  animation: dashboardFadeIn 220ms ease-out both;
}
@keyframes transcriptSweep {
  from { background-position: 200% 0; }
  to { background-position: -20% 0; }
}
@keyframes dashboardFadeIn {
  from { opacity: 0; transform: translateY(2px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .transcript-shimmer { animation: none; }
  .dashboard-enter { animation: none; }
}
```

- [ ] **Step 3: Verify lint + build after style changes**

Run: `cd client && npm run lint && npm run build`  
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add client/app/layout.tsx client/app/globals.css
git commit -m "feat(client): add linear-light design tokens and font baseline"
```

## Chunk 2: Dashboard Regions, Integration, and Verification

### Task 6: Build `ControlRail` + `LiveTranscriptStage` (TDD)

**Files:**
- Create: `client/components/dashboard/ControlRail.tsx`
- Create: `client/components/dashboard/LiveTranscriptStage.tsx`
- Create: `client/components/dashboard/__tests__/ControlRail.test.tsx`
- Modify: `client/components/dashboard/__tests__/LiveTranscriptStage.test.tsx`

- [ ] **Step 1: Write failing component tests**

```tsx
it("shows compact mobile error trigger and opens sheet", async () => {
  render(<ControlRail isMobile hasError errorMessage="x" ... />);
  await user.click(screen.getByRole("button", { name: /show error details/i }));
  expect(screen.getByText("x")).toBeInTheDocument();
});
```

```tsx
it("applies shimmer only when processing", () => {
  render(<LiveTranscriptStage text="processing" isProcessing freshness="LIVE" />);
  expect(screen.getByTestId("live-transcript-text")).toHaveClass("transcript-shimmer");
});
```

- [ ] **Step 2: Run tests and confirm failures**

Run: `cd client && npm run test:unit -- client/components/dashboard/__tests__/ControlRail.test.tsx client/components/dashboard/__tests__/LiveTranscriptStage.test.tsx`  
Expected: FAIL with missing components.

- [ ] **Step 3: Implement components minimally**

```tsx
// ControlRail: sticky row, start/stop buttons, connection/listening chips, error slot + mobile sheet
// LiveTranscriptStage: transcript body, LIVE/IDLE/STALE badge, shimmer class when processing
```

- [ ] **Step 4: Re-run tests**

Run: `cd client && npm run test:unit -- client/components/dashboard/__tests__/ControlRail.test.tsx client/components/dashboard/__tests__/LiveTranscriptStage.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/components/dashboard/ControlRail.tsx client/components/dashboard/LiveTranscriptStage.tsx client/components/dashboard/__tests__/ControlRail.test.tsx client/components/dashboard/__tests__/LiveTranscriptStage.test.tsx
git commit -m "feat(client): add control rail and live transcript stage"
```

### Task 7: Build Metrics/Stream/Detail Panels + Follow-Latest Behavior (TDD)

**Files:**
- Create: `client/components/dashboard/RealtimeOpsStack.tsx`
- Create: `client/components/dashboard/UtteranceStreamPanel.tsx`
- Create: `client/components/dashboard/EmotionDetailPanel.tsx`
- Create: `client/components/dashboard/__tests__/UtteranceStreamPanel.test.tsx`

- [ ] **Step 1: Write failing list/panel tests**

```tsx
it("calls onToggleFollow(false) when user manually selects another utterance", async () => {
  const onToggleFollow = vi.fn();
  const onSelect = vi.fn();
  render(<UtteranceStreamPanel followLatest utterances={fixtures} onToggleFollow={onToggleFollow} onSelect={onSelect} />);
  await user.click(screen.getByRole("button", { name: /utterance u-2/i }));
  expect(onToggleFollow).toHaveBeenCalledWith(false);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd client && npm run test:unit -- client/components/dashboard/__tests__/UtteranceStreamPanel.test.tsx`  
Expected: FAIL with missing panel modules.

- [ ] **Step 3: Implement panels**

```tsx
// RealtimeOpsStack: 3x2 dense cards on desktop, compact value formatting
// UtteranceStreamPanel: status chips, clamped text + Expand/Collapse, follow-latest toggle
// EmotionDetailPanel: selected emotion summary + radar slot passthrough
```

- [ ] **Step 4: Re-run tests**

Run: `cd client && npm run test:unit -- client/components/dashboard/__tests__/UtteranceStreamPanel.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/components/dashboard/RealtimeOpsStack.tsx client/components/dashboard/UtteranceStreamPanel.tsx client/components/dashboard/EmotionDetailPanel.tsx client/components/dashboard/__tests__/UtteranceStreamPanel.test.tsx
git commit -m "feat(client): add dense ops stack and utterance detail panels"
```

### Task 8: Build `ProviderAdvancedPanel` Wrapper + Persistence Contract

**Files:**
- Create: `client/components/dashboard/ProviderAdvancedPanel.tsx`
- Modify: `client/components/ProviderManager.tsx` (only as needed for callback-friendly props)

- [ ] **Step 1: Write failing wrapper behavior test**

Add test asserting default collapsed state and persisted open-state key:

```tsx
expect(localStorage.getItem("ai-emotion::dashboard::provider-panel-open::v1")).toBe("true");
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd client && npm run test:unit -- client/components/dashboard/__tests__/ProviderAdvancedPanel.test.tsx`  
Expected: FAIL because provider wrapper behavior is not implemented.

- [ ] **Step 3: Implement wrapper**

```tsx
// Collapsible "Advanced" section that wraps existing ProviderManager
// Persist only panel open-state in localStorage (post-mount, try/catch guarded)
```

- [ ] **Step 4: Re-run unit tests**

Run: `cd client && npm run test:unit`  
Expected: PASS for all unit tests.

- [ ] **Step 5: Commit**

```bash
git add client/components/dashboard/ProviderAdvancedPanel.tsx client/components/ProviderManager.tsx
git commit -m "feat(client): add advanced provider panel with safe persistence"
```

### Task 9: Integrate New Shell into `app/page.tsx`

**Files:**
- Create: `client/components/dashboard/DashboardShell.tsx`
- Modify: `client/app/page.tsx`
- Modify: `client/components/MetricsCards.tsx` (optional removal or keep as compatibility wrapper)
- Modify: `client/components/UtteranceList.tsx` (optional removal or keep as compatibility wrapper)

- [ ] **Step 1: Add failing integration test**

Create a render test that expects all required regions (`ControlRail`, `LiveTranscriptStage`, `RealtimeOpsStack`, `UtteranceStreamPanel`, `EmotionDetailPanel`, `ProviderAdvancedPanel`) from `DashboardShell`.

- [ ] **Step 2: Run integration test and confirm failure**

Run: `cd client && npm run test:unit -- client/components/dashboard/__tests__/DashboardShell.test.tsx`  
Expected: FAIL with missing shell integration.

- [ ] **Step 3: Implement integration with command/error rules**

```tsx
// page.tsx
// - keep reducer event parsing
// - add followLatest + selectedId fallback rules
// - add errorVersion increment on WS error/status.last_error/start-stop failures
// - add withCommandTimeout + commandSeq stale response guard
// - render DashboardShell with region props/callbacks
```

- [ ] **Step 4: Run full quality gate**

Run: `cd client && npm run lint && npm run test:unit && npm run build`  
Expected: PASS for all commands.

- [ ] **Step 5: Commit**

```bash
git add client/app/page.tsx client/components/dashboard/DashboardShell.tsx client/components/dashboard
git commit -m "feat(client): integrate linear-light dense dashboard shell"
```

### Task 10: Final Verification + Docs Sync

**Files:**
- Modify: `README.md` (client UI behavior section, if needed)
- Modify: `docs/superpowers/specs/2026-03-19-ai-emotion-client-linear-light-dense-console-design.md` (only if implementation-constrained clarifications are required)

- [ ] **Step 1: Run manual responsive checks**

Run app locally and verify at widths `375`, `768`, `1280`:
- sticky single-row `ControlRail`
- hero transcript above fold on desktop
- 6 metrics visible in `1280x800`
- mobile error sheet and follow toggle behavior

- [ ] **Step 2: Run final automated gate**

Run: `cd client && npm run lint && npm run test:unit && npm run build`  
Expected: PASS with zero test failures and successful production build.

- [ ] **Step 3: Commit final polish**

```bash
git add README.md docs/superpowers/specs/2026-03-19-ai-emotion-client-linear-light-dense-console-design.md
git commit -m "docs: sync dashboard redesign behavior and verification notes"
```
