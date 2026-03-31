# AI Emotion Client Console/Settings Split Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `/client` into route-level Console (`/`) and Settings (`/settings`) pages, with Settings owning language + runtime endpoint + provider management and Console containing runtime operations only.

**Architecture:** Keep `client/app/page.tsx` as console business-state owner, but remove config UI from dashboard shell. Add a shared `AppShell` for top tabs, move i18n provider to app-level client providers, and introduce runtime config helpers in `client/lib/config.ts` with deterministic fallback/warning contracts. Build Settings as composed sections (`language`, `endpoint`, `provider`) with `SettingsPage` orchestrating single-flight endpoint mutations and provider remount semantics.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, Vitest + React Testing Library.

---

## Scope Check

This is one frontend subsystem (`client`) with tightly coupled route/UI/state changes and should ship as one implementation plan.

## Execution Skills

- `@test-driven-development`
- `@verification-before-completion`
- `@requesting-code-review`

## File Structure (Target)

- Create: `client/components/providers/ClientProviders.tsx` (app-level client context boundary)
- Create: `client/components/navigation/AppShell.tsx` (shared top tabs and page container)
- Create: `client/components/navigation/__tests__/AppShell.test.tsx`
- Create: `client/app/settings/page.tsx`
- Create: `client/components/settings/SettingsPage.tsx` (settings orchestration + section composition)
- Create: `client/components/settings/SettingsLanguageSection.tsx`
- Create: `client/components/settings/SettingsEndpointSection.tsx`
- Create: `client/components/settings/SettingsProviderSection.tsx`
- Create: `client/components/settings/__tests__/SettingsPage.test.tsx`
- Create: `client/components/settings/__tests__/SettingsLanguageSection.test.tsx`
- Create: `client/components/settings/__tests__/SettingsEndpointSection.test.tsx`
- Create: `client/app/__tests__/ConsoleRoute.test.tsx`
- Create: `client/lib/__tests__/config.test.ts`
- Modify: `client/app/layout.tsx` (mount `ClientProviders` while staying Server Component)
- Modify: `client/app/page.tsx` (read runtime config on mount, bind API/WS dynamically, remove config responsibilities)
- Modify: `client/components/dashboard/DashboardShell.tsx` (pure console layout, no locale switcher/endpoints/provider panel)
- Modify: `client/components/dashboard/__tests__/DashboardShell.test.tsx`
- Modify: `client/lib/config.ts` (runtime config contracts + load/save/reset/validate helpers + constants)
- Modify: `client/lib/i18n.tsx` (add message keys for nav/settings sections and endpoint errors/warnings)
- Optional cleanup (if fully unused after migration): `client/components/dashboard/ProviderAdvancedPanel.tsx` + related tests

## Chunk 1: Route Split + Runtime Config + Settings UI

### Task 1: Preflight and Baseline Verification

**Files:**
- Modify: none
- Test: existing `client` checks

- [ ] **Step 1: Verify you are on a dedicated worktree**

Run: `git worktree list`  
Expected: active path is isolated for this feature; if not, create one before editing.

- [ ] **Step 2: Capture baseline quality gate**

Run:
```bash
cd client
npm run lint
npm run test:unit
npm run build
```
Expected: all commands PASS before code changes (or failures documented as pre-existing).

- [ ] **Step 3: Commit baseline note (optional if no file change)**

If a tracking note is added (e.g. `notes/preflight.md`), commit it; otherwise skip commit for this task.

### Task 2: Move I18n Provider to App-Level Client Boundary

**Files:**
- Create: `client/components/providers/ClientProviders.tsx`
- Modify: `client/app/layout.tsx`
- Modify: `client/components/dashboard/DashboardShell.tsx`
- Test: `client/components/dashboard/__tests__/DashboardShell.test.tsx`

- [ ] **Step 1: Write failing test for DashboardShell config leakage**

In `client/components/dashboard/__tests__/DashboardShell.test.tsx`, add assertions that Console shell does **not** render:
- endpoint text (`API:`, `WS:`)
- locale toggle (`EN`, `中文`)
- advanced provider toggle

Run: `cd client && npm run test:unit -- client/components/dashboard/__tests__/DashboardShell.test.tsx`  
Expected: FAIL because current shell still renders those controls.

- [ ] **Step 2: Add app-level client providers**

Create `client/components/providers/ClientProviders.tsx`:

```tsx
"use client";

import React from "react";
import { DashboardI18nProvider } from "@/lib/i18n";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return <DashboardI18nProvider>{children}</DashboardI18nProvider>;
}
```

- [ ] **Step 3: Mount client providers in server layout**

Update `client/app/layout.tsx` body wrapper:

```tsx
import { ClientProviders } from "@/components/providers/ClientProviders";
import "./globals.css";
import { JetBrains_Mono, Outfit } from "next/font/google";
import type { Metadata } from "next";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-ui" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "AI Emotion Monitor",
  description: "Speech recognition visualization, tracking and monitoring",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className={`${outfit.variable} ${jetbrainsMono.variable} antialiased`}>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Remove local i18n provider from DashboardShell**

In `client/components/dashboard/DashboardShell.tsx`:
- remove `DashboardI18nProvider` wrapper
- keep `useI18n()` usage in content component
- drop `apiBase`, `wsUrl`, `activeProviderId`, `providerPanelContent` props
- remove header block that renders locale switcher and endpoints
- remove `ProviderAdvancedPanel` region

- [ ] **Step 5: Re-run focused test**

Run: `cd client && npm run test:unit -- client/components/dashboard/__tests__/DashboardShell.test.tsx`  
Expected: PASS with dashboard regions still present and config controls absent.

- [ ] **Step 6: Commit**

```bash
git add client/components/providers/ClientProviders.tsx client/app/layout.tsx client/components/dashboard/DashboardShell.tsx client/components/dashboard/__tests__/DashboardShell.test.tsx
git commit -m "refactor(client): move i18n provider to app level and strip config UI from dashboard shell"
```

### Task 3: Add Shared AppShell Navigation (Console/Settings Tabs)

**Files:**
- Create: `client/components/navigation/AppShell.tsx`
- Create: `client/components/navigation/__tests__/AppShell.test.tsx`
- Modify: `client/lib/i18n.tsx`

- [ ] **Step 1: Write failing AppShell test**

Create `client/components/navigation/__tests__/AppShell.test.tsx`:
- render with `activeTab="console"` and `activeTab="settings"`
- expect two nav links (console/settings)
- expect active tab has `aria-current="page"`
- expect labels from i18n keys (EN + 中文 switch still works globally)

Run: `cd client && npm run test:unit -- client/components/navigation/__tests__/AppShell.test.tsx`  
Expected: FAIL (component and keys missing).

- [ ] **Step 2: Add i18n keys for navigation/settings copy**

In `client/lib/i18n.tsx`, add keys in EN/ZH tables:
- `navConsole`, `navSettings`
- `settingsTitle`, `settingsDescription`
- `settingsLanguageTitle`, `settingsEndpointTitle`, `settingsProviderTitle`
- endpoint validation/error/warning strings used by settings sections

- [ ] **Step 3: Implement AppShell**

Create `client/components/navigation/AppShell.tsx`:

```tsx
"use client";
import Link from "next/link";
import React from "react";
import { useI18n } from "@/lib/i18n";

type AppShellProps = { activeTab: "console" | "settings"; children: React.ReactNode };

export function AppShell({ activeTab, children }: AppShellProps) {
  const { t } = useI18n();
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[1400px] flex-col gap-5 px-4 py-6 md:px-6 md:py-7">
      <header className="dashboard-enter rounded-[2.25rem] border border-white/60 bg-white/70 p-5 backdrop-blur-sm">
        <nav aria-label="Primary">
          <ul className="inline-flex rounded-full border border-[color:var(--border)] bg-white/85 p-1">
            <li><Link aria-current={activeTab === "console" ? "page" : undefined} href="/">{t("navConsole")}</Link></li>
            <li><Link aria-current={activeTab === "settings" ? "page" : undefined} href="/settings">{t("navSettings")}</Link></li>
          </ul>
        </nav>
      </header>
      {children}
    </main>
  );
}
```

- [ ] **Step 4: Re-run navigation test**

Run: `cd client && npm run test:unit -- client/components/navigation/__tests__/AppShell.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/components/navigation/AppShell.tsx client/components/navigation/__tests__/AppShell.test.tsx client/lib/i18n.tsx
git commit -m "feat(client): add shared app shell with localized console/settings tabs"
```

### Task 4: Implement Runtime Config Contracts in `lib/config.ts`

**Files:**
- Modify: `client/lib/config.ts`
- Create: `client/lib/__tests__/config.test.ts`

- [ ] **Step 1: Write failing runtime-config unit tests**

Create `client/lib/__tests__/config.test.ts` covering:
- default load from env fallback constants
- storage key uses `ai-emotion::runtime-config::v1`
- load result returns `source: "local_storage" | "env_default"` correctly
- invalid JSON fallback (`warningCode = "invalid_json"`)
- invalid shape fallback (`warningCode = "invalid_shape"`)
- version mismatch fallback (`warningCode = "version_mismatch"`)
- invalid env default fallback (`warningCode = "invalid_env_default"`) with hardcoded safe defaults
- env default shape/scheme validation before becoming effective config
- save/reset behavior and `RuntimeConfigActionResult` semantics
- validation (`http/https`, `ws/wss`)
- storage unavailable fallback and non-throw behavior

Run: `cd client && npm run test:unit -- client/lib/__tests__/config.test.ts`  
Expected: FAIL with missing exports.

- [ ] **Step 2: Implement required contracts and helpers**

In `client/lib/config.ts` export:
- constants: storage keys and safe defaults
- types: `RuntimeConfig`, `RuntimeWarningCode`, `RuntimeConfigValidationError`, `RuntimeConfigLoadResult`, `RuntimeConfigActionResult`
- functions: `validateRuntimeConfigInput`, `loadRuntimeConfig`, `saveRuntimeConfig`, `resetRuntimeConfigToDefault`

Also keep convenience defaults:

```ts
export const API_BASE = DEFAULT_RUNTIME_CONFIG.apiBase;
export const WS_URL = DEFAULT_RUNTIME_CONFIG.wsUrl;
```

- [ ] **Step 3: Re-run config tests**

Run: `cd client && npm run test:unit -- client/lib/__tests__/config.test.ts`  
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add client/lib/config.ts client/lib/__tests__/config.test.ts
git commit -m "feat(client): add runtime endpoint config contracts with deterministic fallback rules"
```

### Task 5: Build Settings Section Components (Language/Endpoint/Provider)

**Files:**
- Create: `client/components/settings/SettingsLanguageSection.tsx`
- Create: `client/components/settings/SettingsEndpointSection.tsx`
- Create: `client/components/settings/SettingsProviderSection.tsx`
- Create: `client/components/settings/__tests__/SettingsLanguageSection.test.tsx`
- Create: `client/components/settings/__tests__/SettingsEndpointSection.test.tsx`

- [ ] **Step 1: Write failing section tests (language + endpoint)**

Create `client/components/settings/__tests__/SettingsLanguageSection.test.tsx`:
- renders both locale options
- selected locale is visually/semantically active
- clicking another locale triggers `onChangeLocale(next)`

Create `client/components/settings/__tests__/SettingsEndpointSection.test.tsx`:
- renders api/ws inputs
- calls `onSave` with current form values
- save/reset disabled when `isSaving=true`
- warning banner hidden when code is dismissed
- dismiss click triggers `onDismissWarning(code)`
- provider section lock contract is validated in `SettingsPage.test.tsx` by asserting provider wrapper disabled while endpoint mutation is active

Run:
```bash
cd client
npm run test:unit -- client/components/settings/__tests__/SettingsLanguageSection.test.tsx
npm run test:unit -- client/components/settings/__tests__/SettingsEndpointSection.test.tsx
```  
Expected: both FAIL (components absent).

- [ ] **Step 2: Implement language section**

Create `SettingsLanguageSection.tsx` as pure presentational toggle using `locale` and `onChangeLocale`.

- [ ] **Step 3: Implement endpoint section**

Create `SettingsEndpointSection.tsx`:
- local form state seeded from `value`
- inline validation error rendering
- warning banner rendering using `warningCode` + `dismissedWarningCodes`
- Save/Reset buttons wired to callbacks and disabled on mutation

- [ ] **Step 4: Implement provider section wrapper**

Create `SettingsProviderSection.tsx`:

```tsx
<fieldset disabled={isEndpointMutating}>
  <ProviderManager key={apiBaseRevision} apiBase={apiBase} activeProviderId={null} />
</fieldset>
```

- [ ] **Step 5: Re-run section tests**

Run:
```bash
cd client
npm run test:unit -- client/components/settings/__tests__/SettingsLanguageSection.test.tsx
npm run test:unit -- client/components/settings/__tests__/SettingsEndpointSection.test.tsx
```  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/components/settings/SettingsLanguageSection.tsx client/components/settings/SettingsEndpointSection.tsx client/components/settings/SettingsProviderSection.tsx client/components/settings/__tests__/SettingsLanguageSection.test.tsx client/components/settings/__tests__/SettingsEndpointSection.test.tsx
git commit -m "feat(client): add settings sections for language endpoint and provider"
```

### Task 6: Compose SettingsPage Orchestration + `/settings` Route

**Files:**
- Create: `client/components/settings/SettingsPage.tsx`
- Create: `client/components/settings/__tests__/SettingsPage.test.tsx`
- Create: `client/app/settings/page.tsx`

- [ ] **Step 1: Write failing SettingsPage orchestration tests**

Create `client/components/settings/__tests__/SettingsPage.test.tsx` covering:
- initial load uses `loadRuntimeConfig()`
- save success with changed `apiBase` increments provider remount token
- save success with only `wsUrl` change does not increment provider remount token
- failed save keeps old effective config
- failed save/reset does not increment `apiBaseRevision`
- single-flight behavior disables overlapping save/reset
- save success persists endpoints and rehydrates same values on remount/revisit
- stale provider responses from prior `apiBaseRevision` do not mutate current UI
- provider section wrapper is disabled while `isEndpointMutating=true`
- dismissed warning codes hydrate/writeback with `sessionStorage`
- warning dedupe falls back to in-memory behavior when `sessionStorage` is unavailable
- storage write failure surfaces non-blocking inline error in settings endpoint section

Run: `cd client && npm run test:unit -- client/components/settings/__tests__/SettingsPage.test.tsx`  
Expected: FAIL (page missing).

- [ ] **Step 2: Implement `SettingsPage`**

Implement state initialization only:
- `runtimeConfig`
- `warningCode`
- `mutationState: "idle" | "saving" | "resetting"`
- `apiBaseRevision`

- [ ] **Step 3: Implement endpoint mutation handlers**

Add `handleSave` / `handleReset` with rules:
- single-flight lock (`saving`/`resetting`)
- on `ok=false` keep old effective config
- on `ok=true` increment `apiBaseRevision` only when `apiBase` changes
- `warningCode` adopts mutation result warning

- [ ] **Step 4: Implement warning dedupe persistence**

Implement `dismissedWarningCodes` lifecycle:
- hydrate once from `sessionStorage` key `ai-emotion::runtime-warning-dismissed::v1`
- write back on dismissal changes
- fallback to in-memory dedupe if storage unavailable

- [ ] **Step 5: Implement provider stale-response safety path**

Ensure provider section remount key is based on `apiBaseRevision` and add guard that stale async outcomes from prior revision do not overwrite current UI state.

- [ ] **Step 6: Implement `/settings` route wrapper**

`client/app/settings/page.tsx`:

```tsx
import { AppShell } from "@/components/navigation/AppShell";
import { SettingsPage } from "@/components/settings/SettingsPage";

export default function SettingsRoute() {
  return (
    <AppShell activeTab="settings">
      <SettingsPage />
    </AppShell>
  );
}
```

- [ ] **Step 7: Re-run settings page test**

Run: `cd client && npm run test:unit -- client/components/settings/__tests__/SettingsPage.test.tsx`  
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add client/components/settings/SettingsPage.tsx client/components/settings/__tests__/SettingsPage.test.tsx client/app/settings/page.tsx
git commit -m "feat(client): add settings route with runtime config orchestration"
```

### Task 7: Refactor Console Route to Consume Runtime Config and AppShell

**Files:**
- Modify: `client/app/page.tsx`
- Modify: `client/components/dashboard/DashboardShell.tsx`
- Modify: `client/components/dashboard/__tests__/DashboardShell.test.tsx`
- Create: `client/app/__tests__/ConsoleRoute.test.tsx`

- [ ] **Step 1: Write failing console binding test**

Extend `DashboardShell.test.tsx` to assert:
- console-only regions still render
- no settings sections or provider advanced panel appear

Create `client/app/__tests__/ConsoleRoute.test.tsx` to verify `app/page.tsx` binds runtime config values to request/event logic via mocked fetch and `useEventStream`.

Run:
```bash
cd client
npm run test:unit -- client/components/dashboard/__tests__/DashboardShell.test.tsx
npm run test:unit -- client/app/__tests__/ConsoleRoute.test.tsx
```  
Expected: FAIL until page/shell contracts are updated.

- [ ] **Step 2: Update `app/page.tsx` runtime binding**

Key changes:
- load effective runtime config on mount
- store `runtimeConfig` in local state
- use `runtimeConfig.apiBase` in `postJson`
- use `runtimeConfig.wsUrl` in `useEventStream`
- wrap rendered dashboard in `<AppShell activeTab="console">`

- [ ] **Step 3: Update DashboardShell callsite contract**

Remove old props from render:
- `apiBase`
- `wsUrl`
- `activeProviderId`
- `providerPanelContent`

- [ ] **Step 4: Re-run focused tests**

Run:
```bash
cd client
npm run test:unit -- client/components/dashboard/__tests__/DashboardShell.test.tsx
npm run test:unit -- client/app/__tests__/ConsoleRoute.test.tsx
npm run test:unit -- client/components/settings/__tests__/SettingsPage.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/app/page.tsx client/components/dashboard/DashboardShell.tsx client/components/dashboard/__tests__/DashboardShell.test.tsx client/app/__tests__/ConsoleRoute.test.tsx
git commit -m "refactor(client): bind console route to runtime config and shared app shell"
```

### Task 8: Full Verification and Final Cleanup

**Files:**
- Modify: any snapshot/test fixtures changed by previous tasks
- Optional delete: `client/components/dashboard/ProviderAdvancedPanel.tsx` and its test if no longer referenced

- [ ] **Step 1: Run full client quality gate**

Run:
```bash
cd client
npm run lint
npm run test:unit
npm run build
```
Expected: all PASS.

- [ ] **Step 2: Manual route verification**

Run: `cd client && npm run dev`  
Checklist:
- `/` shows only console UI (PASS if no language switcher/endpoint/provider panel controls are visible)
- `/settings` shows language + endpoint + provider (PASS if all three sections render)
- locale persists across refresh and applies to both routes (PASS if language switch in `/settings` is still effective after full page refresh and when returning to `/`)
- endpoint change affects provider section immediately (PASS if provider list reloads using new `apiBase`)
- provider CRUD/activate/test continuity remains intact (PASS if create/edit/test/delete/activate all work on `/settings` after endpoint changes)
- console picks new endpoints only after remount/navigation back (PASS if mounted console does not hot-rebind)
- warning banner appears/dismisses per session rule (PASS if dismiss survives remount in same tab session)
- console never shows runtime-config warning banner (PASS if warning UI is settings-only)

- [ ] **Step 3: Commit final polish**

```bash
git add client/app/layout.tsx client/app/page.tsx client/app/settings/page.tsx client/app/__tests__/ConsoleRoute.test.tsx client/components/providers/ClientProviders.tsx client/components/navigation/AppShell.tsx client/components/navigation/__tests__/AppShell.test.tsx client/components/settings/SettingsPage.tsx client/components/settings/SettingsLanguageSection.tsx client/components/settings/SettingsEndpointSection.tsx client/components/settings/SettingsProviderSection.tsx client/components/settings/__tests__/SettingsPage.test.tsx client/components/settings/__tests__/SettingsLanguageSection.test.tsx client/components/settings/__tests__/SettingsEndpointSection.test.tsx client/components/dashboard/DashboardShell.tsx client/components/dashboard/__tests__/DashboardShell.test.tsx client/lib/config.ts client/lib/__tests__/config.test.ts client/lib/i18n.tsx
git commit -m "feat(client): split console and settings routes with runtime config settings"
```

- [ ] **Step 4: Request review**

Run: `@requesting-code-review` and address findings before merge.
