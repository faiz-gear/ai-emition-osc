import type {
  CreateProviderRequest,
  DesktopApi,
  PatchProviderRequest,
  ProviderSummary,
  ProviderTestResult,
  RecognitionStrategy,
  RuntimeEvent,
  RuntimeSnapshot,
} from "@ai-emotion/contracts";

import type { AsrSettingsState } from "@/lib/types";

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
  downloadAsrModel: (modelId: string) => Promise<void>;
  activateAsrModel: (modelId: string) => Promise<void>;
  deleteAsrModel: (modelId: string) => Promise<void>;
  updateRecognitionStrategy: (input: RecognitionStrategy) => Promise<RecognitionStrategy>;
  listProviders: () => Promise<{ providers: ProviderSummary[] }>;
  createProvider: (input: CreateProviderRequest) => Promise<ProviderSummary>;
  updateProvider: (providerId: string, patch: PatchProviderRequest) => Promise<ProviderSummary>;
  deleteProvider: (providerId: string) => Promise<void>;
  testProvider: (providerId: string) => Promise<ProviderTestResult>;
  activateProvider: (providerId: string) => Promise<void>;
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
    downloadAsrModel(modelId) {
      return api.asr.downloadModel(modelId);
    },
    activateAsrModel(modelId) {
      return api.asr.activateModel(modelId);
    },
    deleteAsrModel(modelId) {
      return api.asr.deleteModel(modelId);
    },
    updateRecognitionStrategy(input) {
      return api.asr.updateRecognitionStrategy(input);
    },
    listProviders() {
      return api.providers.list();
    },
    createProvider(input) {
      return api.providers.create(input);
    },
    updateProvider(providerId, patch) {
      return api.providers.update(providerId, patch);
    },
    deleteProvider(providerId) {
      return api.providers.delete(providerId);
    },
    testProvider(providerId) {
      return api.providers.test(providerId);
    },
    activateProvider(providerId) {
      return api.providers.activate(providerId);
    },
  };
}

export function getDesktopClient(): DesktopRuntimeClient {
  if (!singleton) {
    singleton = createDesktopClient(resolveDesktopApi());
  }
  return singleton;
}
