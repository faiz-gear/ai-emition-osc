---
title: Desktop Runtime Composition Root
date: 2026-04-12
problem_type: architecture
component: electron-main
---

## Context

Electron main was directly importing the in-memory IPC service singleton. That kept the UI flow testable, but it also meant the real desktop runtime modules under `desktop/src/runtime` had no explicit assembly boundary and no controlled lifecycle.

## Guidance

Introduce a composition root in `desktop/src/main/runtime/create-desktop-ipc-services.ts` and make Electron bootstrap consume that boundary instead of importing a concrete runtime directly.

Use an explicit runtime mode:

- `desktop` for the real runtime path
- `in-memory` for tests and harness flows

Resolve the mode centrally, then keep `registerIpc()` pure by always passing a ready `DesktopIpcServices` instance in from the caller.

## Why This Matters

This gives the desktop app a real composition boundary:

- runtime selection is explicit instead of hidden in imports
- desktop-only resources can be initialized once and disposed once
- tests can keep using the in-memory harness without drifting from production bootstrap
- future work such as diagnostics, packaging hooks, and alternate runtimes has a single entry point

## When To Apply

Apply this pattern whenever Electron main needs to choose or assemble runtime dependencies, especially when a module tree mixes production services and test harnesses.

## Examples

Before:

```ts
import { getDefaultDesktopIpcServices } from "./ipc/in-memory-desktop-ipc-services";

registerIpc();
void getDefaultDesktopIpcServices().session.stopListening();
```

After:

```ts
import { getDefaultDesktopIpcServices } from "./runtime/create-desktop-ipc-services";

const services = await getDefaultDesktopIpcServices();
registerIpc(services);
void services.session.stopListening();
```
