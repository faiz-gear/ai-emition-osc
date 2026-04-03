import type { DesktopApi } from "@ai-emotion/contracts";

import type { AsrSettingsState, RuntimeEvent, RuntimeSnapshot } from "@/lib/types";

declare global {
  interface Window {
    desktopApi?: DesktopApi;
  }
}

export type DesktopRuntimeClient = {
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  getSnapshot: () => Promise<RuntimeSnapshot>;
  subscribe: (listener: (event: RuntimeEvent) => void) => () => void;
  getAsrSettings: () => Promise<AsrSettingsState>;
};

let singleton: DesktopRuntimeClient | null = null;

function resolveDesktopApi(): DesktopApi {
  if (typeof window === "undefined" || !window.desktopApi) {
    throw new Error("desktop api unavailable");
  }
  return window.desktopApi;
}

export function createDesktopClient(api: DesktopApi): DesktopRuntimeClient {
  return {
    startListening() {
      return api.session.startListening();
    },
    stopListening() {
      return api.session.stopListening();
    },
    getSnapshot() {
      return api.session.getSnapshot();
    },
    subscribe(listener) {
      return api.session.subscribe(listener);
    },
    async getAsrSettings() {
      const [catalog, installedModels, recognitionStrategy] = await Promise.all([
        api.asr.listCatalog(),
        api.asr.listInstalled(),
        api.asr.getRecognitionStrategy(),
      ]);
      return {
        catalog,
        installedModels,
        recognitionStrategy,
      };
    },
  };
}

export function getDesktopClient(): DesktopRuntimeClient {
  if (!singleton) {
    singleton = createDesktopClient(resolveDesktopApi());
  }
  return singleton;
}
