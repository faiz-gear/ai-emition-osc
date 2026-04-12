import { BrowserWindow, app } from "electron";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import rendererPathContract from "../../renderer-path.contract.json";
import type { DesktopIpcServices } from "./ipc/desktop-ipc-services";
import { registerIpc } from "./ipc/register-ipc";
import { getDefaultDesktopIpcServices } from "./runtime/create-desktop-ipc-services";
import { createMainWindow } from "./windows/create-main-window";
import { destroyCaptureWindow, resolveCaptureEntry } from "./windows/capture-window-runtime";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let ipcRegistered = false;
let quitCleanupRegistered = false;
let mainWindow: BrowserWindow | null = null;
let desktopServicesPromise: Promise<DesktopIpcServices> | null = null;

export function resolveRendererEntry(isDev: boolean): string {
  if (isDev) {
    return "http://localhost:3000";
  }

  return resolve(
    __dirname,
    `../../../${rendererPathContract.rendererDistDir}/${rendererPathContract.rendererEntryFile}`
  );
}

function ensureMainWindow(isDev: boolean, services: DesktopIpcServices): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createMainWindow(resolveRendererEntry(isDev), isDev);
    mainWindow.on("closed", () => {
      void services.session
        .stopListening()
        .catch(() => undefined)
        .finally(() => {
          destroyCaptureWindow();
        });
      mainWindow = null;
    });
  }
}

export async function bootstrapMain(isDev = process.env.NODE_ENV === "development"): Promise<void> {
  await app.whenReady();
  desktopServicesPromise ??= getDefaultDesktopIpcServices();
  const services = await desktopServicesPromise;
  if (!ipcRegistered) {
    registerIpc(services);
    ipcRegistered = true;
  }
  if (!quitCleanupRegistered) {
    app.once("will-quit", () => {
      void desktopServicesPromise
        ?.then((activeServices) => activeServices.dispose?.())
        .catch(() => undefined);
    });
    quitCleanupRegistered = true;
  }
  ensureMainWindow(isDev, services);
  app.on("activate", () => {
    void desktopServicesPromise
      ?.then((activeServices) => {
        ensureMainWindow(isDev, activeServices);
      })
      .catch(() => undefined);
  });
}

export { resolveCaptureEntry };
