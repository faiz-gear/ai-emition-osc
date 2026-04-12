---
title: Desktop renderer builds must not depend on Google Fonts
date: 2026-04-12
category: architecture
---

# Desktop renderer builds must not depend on Google Fonts

## Context

This Electron desktop workspace statically exports the Next.js renderer as part of `npm run build`.
That build is expected to succeed in CI, sandboxed environments, and other restricted networks.

## Problem

`client/app/layout.tsx` imported `Outfit` and `JetBrains Mono` from `next/font/google`.
During `next build`, Next.js attempted to fetch those fonts from `fonts.googleapis.com`.
In a restricted environment, the renderer build failed before Electron packaging could complete.

## Resolution

Replace remote Google font loading with local system font stacks defined in `client/app/globals.css`.
Keep the renderer typography stable enough for the product UI, but remove any build-time dependency on external font fetches.

## Rule

For the desktop renderer path:

- Prefer local/system font stacks.
- Do not introduce `next/font/google` into the production desktop build path.
- Treat offline buildability as a release requirement, not a CI convenience.

## Verification

- `npm run build`
- `npm run contracts:build && npm run test --workspace @ai-emotion/desktop`

The desktop test suite still has the existing sandbox-only `download-manager` failures caused by `listen EPERM 127.0.0.1`, but the renderer font fetch failure is resolved.
