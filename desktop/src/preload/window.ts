import type { DesktopApi } from "@ai-emotion/contracts";
import type { CaptureBridgeApi } from "./desktop-api";

declare global {
  interface Window {
    desktopApi: DesktopApi;
    captureBridge: CaptureBridgeApi;
  }
}

export {};
