import { app } from "electron";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createMainWindow } from "./windows/create-main-window";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function resolveRendererEntry(isDev: boolean): string {
  if (isDev) {
    return "http://localhost:3000";
  }

  return resolve(__dirname, "../../../client-dist/index.html");
}

export async function bootstrapMain(isDev = process.env.NODE_ENV === "development"): Promise<void> {
  await app.whenReady();
  createMainWindow(resolveRendererEntry(isDev), isDev);
  app.on("activate", () => {
    createMainWindow(resolveRendererEntry(isDev), isDev);
  });
}
