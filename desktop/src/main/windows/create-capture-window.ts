import { BrowserWindow } from "electron";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export type CaptureWindowOptions = {
  captureEntry: string;
  isDev: boolean;
};

export function createCaptureWindow(options: CaptureWindowOptions): BrowserWindow {
  const preloadPath = resolve(__dirname, "../../preload/index.js");
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
      sandbox: true,
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
