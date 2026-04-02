import * as electron from "electron";
import { isDesktopErrorCode, type DesktopErrorCode } from "@ai-emotion/contracts";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CAPTURE_STATUS_CHANNEL,
  parseCaptureStatusPayload
} from "../../runtime/asr/capture-ipc";
import { createCaptureWindow } from "./create-capture-window";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let captureWindow: BrowserWindow | null = null;
let captureWindowReady: Promise<BrowserWindow> | null = null;

export function resolveCaptureEntry(isDev: boolean): string {
  if (isDev) {
    return "http://localhost:5173/capture.html";
  }

  return resolve(__dirname, "../../out/renderer/capture.html");
}

export function ensureCaptureWindow(
  isDev = process.env.NODE_ENV === "development"
): Promise<BrowserWindow> {
  if (captureWindow && !captureWindow.isDestroyed()) {
    return captureWindowReady ?? Promise.resolve(captureWindow);
  }

  captureWindow = createCaptureWindow({
    captureEntry: resolveCaptureEntry(isDev),
    isDev
  });
  captureWindow.on("closed", () => {
    captureWindow = null;
    captureWindowReady = null;
  });
  captureWindowReady = waitForCaptureReady(captureWindow).finally(() => {
    captureWindowReady = null;
  });
  return captureWindowReady;
}

export function destroyCaptureWindow(): void {
  if (!captureWindow) {
    return;
  }

  const window = captureWindow;
  captureWindow = null;
  captureWindowReady = null;
  if (window.isDestroyed()) {
    return;
  }

  if (typeof window.close === "function") {
    window.close();
    return;
  }

  if (typeof window.destroy === "function") {
    window.destroy();
  }
}

function waitForCaptureReady(window: BrowserWindow): Promise<BrowserWindow> {
  return new Promise((resolvePromise, rejectPromise) => {
    let settled = false;

    const finalize = (result: { ok: true } | { ok: false; error: Error }) => {
      if (settled) {
        return;
      }
      settled = true;
      electron.ipcMain?.off?.(CAPTURE_STATUS_CHANNEL, onStatus);
      window.webContents.off?.("did-fail-load", onLoadFailure);
      window.off?.("closed", onClosed);

      if (result.ok) {
        resolvePromise(window);
        return;
      }

      destroyCaptureWindow();
      rejectPromise(result.error);
    };

    const onStatus = (event: { sender?: unknown }, payload: unknown) => {
      if (event.sender !== window.webContents) {
        return;
      }

      const status = parseCaptureStatusPayload(payload);
      if (!status) {
        return;
      }

      if (status.type === "ready") {
        finalize({ ok: true });
        return;
      }

      finalize({
        ok: false,
        error: createCaptureRuntimeError(
          status.message,
          status.code ?? "ASR_RECOGNITION_FAILED"
        )
      });
    };

    const onLoadFailure = (
      _event: unknown,
      _code: number,
      description: string
    ) => {
      finalize({
        ok: false,
        error: createCaptureRuntimeError(
          description || "Capture window failed to load",
          "ASR_RECOGNITION_FAILED"
        )
      });
    };

    const onClosed = () => {
      finalize({
        ok: false,
        error: createCaptureRuntimeError(
          "Capture window closed before microphone capture was ready",
          "ASR_RECOGNITION_FAILED"
        )
      });
    };

    electron.ipcMain?.on?.(CAPTURE_STATUS_CHANNEL, onStatus);
    window.webContents.on?.("did-fail-load", onLoadFailure);
    window.on?.("closed", onClosed);
  });
}

function createCaptureRuntimeError(message: string, code: DesktopErrorCode): Error & { code: DesktopErrorCode } {
  const error = new Error(message) as Error & { code: DesktopErrorCode };
  error.code = isDesktopErrorCode(code) ? code : "ASR_RECOGNITION_FAILED";
  return error;
}
