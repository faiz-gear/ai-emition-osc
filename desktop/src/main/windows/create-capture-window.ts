import { BrowserWindow } from "electron";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePreloadPath } from "./preload-path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export type CaptureWindowOptions = {
  captureEntry: string;
  isDev: boolean;
};

export function createCaptureWindow(options: CaptureWindowOptions): BrowserWindow {
  const preloadPath = resolvePreloadPath(__dirname);
  const window = new BrowserWindow({
    width: 1,
    height: 1,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    skipTaskbar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      backgroundThrottling: false,
      preload: preloadPath
    }
  });

  if (options.isDev) {
    void window.loadURL(options.captureEntry);
  } else {
    void window.loadFile(options.captureEntry);
  }

  return window;
}
