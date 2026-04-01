import { BrowserWindow } from "electron";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function createMainWindow(rendererEntry: string, isDev: boolean): BrowserWindow {
  const preloadPath = resolve(__dirname, "../../preload/index.js");
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
