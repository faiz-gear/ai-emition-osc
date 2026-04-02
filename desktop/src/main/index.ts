import { BrowserWindow, app } from "electron";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import rendererPathContract from "../../renderer-path.contract.json";
import { registerIpc } from "./ipc/register-ipc";
import { createCaptureWindow } from "./windows/create-capture-window";
import { createMainWindow } from "./windows/create-main-window";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let ipcRegistered = false;
let mainWindow: BrowserWindow | null = null;
let captureWindow: BrowserWindow | null = null;

export function resolveRendererEntry(isDev: boolean): string {
  if (isDev) {
    return "http://localhost:3000";
  }

  return resolve(
    __dirname,
    `../../../${rendererPathContract.rendererDistDir}/${rendererPathContract.rendererEntryFile}`
  );
}

export function resolveCaptureEntry(isDev: boolean): string {
  if (isDev) {
    return "http://localhost:5173/capture.html";
  }

  return resolve(__dirname, "../../out/renderer/capture.html");
}

function ensureWindows(isDev: boolean): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createMainWindow(resolveRendererEntry(isDev), isDev);
    mainWindow.on("closed", () => {
      mainWindow = null;
    });
  }

  if (!captureWindow || captureWindow.isDestroyed()) {
    captureWindow = createCaptureWindow({
      captureEntry: resolveCaptureEntry(isDev),
      isDev
    });
    captureWindow.on("closed", () => {
      captureWindow = null;
    });
  }
}

export async function bootstrapMain(isDev = process.env.NODE_ENV === "development"): Promise<void> {
  await app.whenReady();
  if (!ipcRegistered) {
    registerIpc();
    ipcRegistered = true;
  }
  ensureWindows(isDev);
  app.on("activate", () => {
    ensureWindows(isDev);
  });
}
