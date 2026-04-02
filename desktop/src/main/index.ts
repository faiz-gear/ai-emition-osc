import { BrowserWindow, app } from "electron";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import rendererPathContract from "../../renderer-path.contract.json";
import { registerIpc } from "./ipc/register-ipc";
import { createMainWindow } from "./windows/create-main-window";
import { destroyCaptureWindow, resolveCaptureEntry } from "./windows/capture-window-runtime";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let ipcRegistered = false;
let mainWindow: BrowserWindow | null = null;

export function resolveRendererEntry(isDev: boolean): string {
  if (isDev) {
    return "http://localhost:3000";
  }

  return resolve(
    __dirname,
    `../../../${rendererPathContract.rendererDistDir}/${rendererPathContract.rendererEntryFile}`
  );
}

function ensureMainWindow(isDev: boolean): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createMainWindow(resolveRendererEntry(isDev), isDev);
    mainWindow.on("closed", () => {
      destroyCaptureWindow();
      mainWindow = null;
    });
  }
}

export async function bootstrapMain(isDev = process.env.NODE_ENV === "development"): Promise<void> {
  await app.whenReady();
  if (!ipcRegistered) {
    registerIpc();
    ipcRegistered = true;
  }
  ensureMainWindow(isDev);
  app.on("activate", () => {
    ensureMainWindow(isDev);
  });
}

export { resolveCaptureEntry };
