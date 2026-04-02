import { BrowserWindow } from "electron";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePreloadPath } from "./preload-path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function createMainWindow(rendererEntry: string, isDev: boolean): BrowserWindow {
  const preloadPath = resolvePreloadPath(__dirname);
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath
    }
  });

  if (isDev) {
    void mainWindow.loadURL(rendererEntry);
  } else {
    void mainWindow.loadFile(rendererEntry);
  }

  return mainWindow;
}
