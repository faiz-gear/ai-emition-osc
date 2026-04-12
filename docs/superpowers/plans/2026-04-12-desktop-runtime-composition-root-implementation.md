# Desktop Runtime Composition Root Implementation

- Date: 2026-04-12
- Status: Implemented

## Goal

Move Electron main bootstrap off the hard-coded in-memory IPC singleton and into an explicit composition root that can select between the production desktop runtime and the existing in-memory harness.

## Landed Changes

1. Added `desktop/src/main/runtime/desktop-runtime-mode.ts` to resolve runtime mode from `AI_EMOTION_DESKTOP_RUNTIME_MODE`, defaulting to `desktop` outside tests and `in-memory` in tests.
2. Added `desktop/src/main/runtime/create-desktop-ipc-services.ts` as the composition root for desktop services.
3. Wired the desktop runtime path to:
   - app config store
   - model store
   - download manager
   - SQLite provider repository
   - provider secret key file under `userData/runtime`
   - provider service
   - emotion service / worker
   - OSC service
4. Updated `desktop/src/main/index.ts` to await the composed services once, register IPC against that instance, and dispose runtime resources on `will-quit`.
5. Removed the default service lookup from `register-ipc.ts`; callers now pass the composed `DesktopIpcServices` instance explicitly.
6. Kept the in-memory harness available for tests and contract verification, and added a `dispose()` hook so both runtime modes share the same lifecycle contract.

## Verification

Passed:

- `npm run build --workspace @ai-emotion/contracts`
- `npm run test --workspace @ai-emotion/desktop -- src/__tests__/main/bootstrap.test.ts src/__tests__/main/runtime/desktop-runtime-mode.test.ts src/__tests__/ipc/register-ipc.test.ts`
- `npm run build --workspace @ai-emotion/desktop`

Known sandbox limitation:

- `npm run test --workspace @ai-emotion/desktop` still fails only in `src/__tests__/runtime/asr/download-manager.test.ts` because the sandbox cannot bind `127.0.0.1` and those tests stand up a local HTTP server.

## Remaining Risk

The composition root is now in place, but end-to-end desktop smoke still needs to be run in a real GUI environment with microphone access and at least one usable provider.
