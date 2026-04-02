import { contextBridge } from "electron";
import { createCaptureBridge, createDesktopApi } from "./desktop-api";

contextBridge.exposeInMainWorld("desktopApi", createDesktopApi());
contextBridge.exposeInMainWorld("captureBridge", createCaptureBridge());
