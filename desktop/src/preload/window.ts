import type { DesktopApi } from "@ai-emotion/contracts";

declare global {
  interface Window {
    desktopApi: DesktopApi;
  }
}

export {};
