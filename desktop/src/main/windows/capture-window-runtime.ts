import type { BrowserWindow } from "electron";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCaptureWindow } from "./create-capture-window";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let captureWindow: BrowserWindow | null = null;

export function resolveCaptureEntry(isDev: boolean): string {
  if (isDev) {
    return "http://localhost:5173/capture.html";
  }

  return resolve(__dirname, "../../out/renderer/capture.html");
}

export function ensureCaptureWindow(
  isDev = process.env.NODE_ENV === "development"
): BrowserWindow {
  if (captureWindow && !captureWindow.isDestroyed()) {
    return captureWindow;
  }

  captureWindow = createCaptureWindow({
    captureEntry: resolveCaptureEntry(isDev),
    isDev
  });
  captureWindow.on("closed", () => {
    captureWindow = null;
  });
  return captureWindow;
}

export function destroyCaptureWindow(): void {
  if (!captureWindow) {
    return;
  }

  const window = captureWindow;
  captureWindow = null;
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
