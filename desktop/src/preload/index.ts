import { contextBridge } from "electron";
import { createDesktopApi } from "./desktop-api";

contextBridge.exposeInMainWorld("desktopApi", createDesktopApi());
