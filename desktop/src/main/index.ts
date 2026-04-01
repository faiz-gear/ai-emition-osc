import { BrowserWindow, app } from "electron";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import rendererPathContract from "../../renderer-path.contract.json";
import { registerIpc } from "./ipc/register-ipc";
import { createMainWindow } from "./windows/create-main-window";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let ipcRegistered = false;

export function resolveRendererEntry(isDev: boolean): string {
  if (isDev) {
    return "http://localhost:3000";
  }

  return resolve(
    __dirname,
    `../../../${rendererPathContract.rendererDistDir}/${rendererPathContract.rendererEntryFile}`
  );
}

export async function bootstrapMain(isDev = process.env.NODE_ENV === "development"): Promise<void> {
  await app.whenReady();
  if (!ipcRegistered) {
    registerIpc();
    ipcRegistered = true;
  }
  createMainWindow(resolveRendererEntry(isDev), isDev);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(resolveRendererEntry(isDev), isDev);
    }
  });
}
