import type {
  AsrModelCatalogItem,
  InstalledAsrModel,
  ProviderSummary,
  RecognitionStrategy,
  RuntimeSnapshot
} from "@ai-emotion/contracts";
import { createRuntimeEventBus } from "./runtime-bus";
import type { DesktopIpcServices } from "./desktop-ipc-services";

type InMemoryRuntimeState = {
  listening: boolean;
  recognitionStrategy: RecognitionStrategy;
  installedModels: InstalledAsrModel[];
  providers: ProviderSummary[];
};

const asrCatalog: AsrModelCatalogItem[] = [
  {
    modelId: "whisper-base",
    name: "Whisper Base",
    language: "multilingual",
    sizeBytes: 146_000_000,
    recommended: true
  }
];

let defaultServices: DesktopIpcServices | undefined;

function createSnapshot(state: InMemoryRuntimeState): RuntimeSnapshot {
  return {
    status: { listening: state.listening },
    metrics: {
      uptime_seconds: 0,
      ws_clients: 0,
      utterances_total: 0,
      emotion_total: 0,
      errors_total: 0
    },
    utterances: []
  };
}

export function createInMemoryDesktopIpcServices(): DesktopIpcServices {
  const runtimeEventBus = createRuntimeEventBus();
  const state: InMemoryRuntimeState = {
    listening: false,
    recognitionStrategy: { mode: "auto" },
    installedModels: [],
    providers: []
  };

  return {
    session: {
      async startListening() {
        state.listening = true;
        runtimeEventBus.publish({
          type: "runtime:status",
          payload: { listening: true }
        });
      },
      async stopListening() {
        state.listening = false;
        runtimeEventBus.publish({
          type: "runtime:status",
          payload: { listening: false }
        });
      }
    },
    runtime: {
      async getSnapshot() {
        return createSnapshot(state);
      },
      subscribe(listener) {
        return runtimeEventBus.subscribe(listener);
      }
    },
    asr: {
      async listCatalog() {
        return [...asrCatalog];
      },
      async listInstalled() {
        return [...state.installedModels];
      },
      async downloadModel(modelId) {
        const catalogItem = asrCatalog.find((item) => item.modelId === modelId);
        if (!catalogItem) {
          throw new Error(`Unknown model: ${modelId}`);
        }

        if (!state.installedModels.some((item) => item.modelId === modelId)) {
          state.installedModels = [
            ...state.installedModels,
            {
              modelId,
              installedAt: new Date().toISOString(),
              sizeBytes: catalogItem.sizeBytes,
              active: state.installedModels.length === 0
            }
          ];
        }
      },
      async activateModel(modelId) {
        state.installedModels = state.installedModels.map((item) => ({
          ...item,
          active: item.modelId === modelId
        }));
      },
      async deleteModel(modelId) {
        state.installedModels = state.installedModels.filter((item) => item.modelId !== modelId);
      },
      async getRecognitionStrategy() {
        return state.recognitionStrategy;
      },
      async updateRecognitionStrategy(input) {
        state.recognitionStrategy = input;
        runtimeEventBus.publish({
          type: "asr:recognition-strategy",
          payload: input
        });
        return state.recognitionStrategy;
      }
    },
    providers: {
      async list() {
        return { providers: [...state.providers] };
      },
      async create(input) {
        const provider: ProviderSummary = {
          id: `provider-${state.providers.length + 1}`,
          name: input.name,
          provider_type: input.provider_type,
          provider_key: input.provider_key ?? null,
          model: input.model,
          base_url: input.base_url ?? null,
          temperature: input.temperature ?? null,
          is_active: state.providers.length === 0,
          updated_at: new Date().toISOString(),
          has_api_key: Boolean(input.api_key),
          headers_keys: input.headers ? Object.keys(input.headers) : null,
          status: "ok",
          error_code: null,
          error_message: null
        };
        state.providers = [...state.providers, provider];
        runtimeEventBus.publish({
          type: "providers:list",
          payload: { providers: [...state.providers] }
        });
        return provider;
      },
      async update(providerId, patch) {
        const current = state.providers.find((provider) => provider.id === providerId);
        if (!current) {
          throw new Error(`Unknown provider: ${providerId}`);
        }

        const updated: ProviderSummary = {
          ...current,
          ...patch,
          updated_at: new Date().toISOString(),
          has_api_key: patch.api_key !== undefined ? Boolean(patch.api_key) : current.has_api_key,
          headers_keys: patch.headers
            ? Object.keys(patch.headers)
            : patch.headers === null
              ? null
              : current.headers_keys
        };
        state.providers = state.providers.map((provider) =>
          provider.id === providerId ? updated : provider
        );
        runtimeEventBus.publish({
          type: "providers:list",
          payload: { providers: [...state.providers] }
        });
        return updated;
      },
      async delete(providerId) {
        state.providers = state.providers.filter((provider) => provider.id !== providerId);
        runtimeEventBus.publish({
          type: "providers:list",
          payload: { providers: [...state.providers] }
        });
      },
      async test() {
        return {
          ok: true,
          latency_ms: 25
        };
      },
      async activate(providerId) {
        state.providers = state.providers.map((provider) => ({
          ...provider,
          is_active: provider.id === providerId
        }));
        runtimeEventBus.publish({
          type: "providers:list",
          payload: { providers: [...state.providers] }
        });
      }
    }
  };
}

export function getDefaultDesktopIpcServices(): DesktopIpcServices {
  if (!defaultServices) {
    defaultServices = createInMemoryDesktopIpcServices();
  }

  return defaultServices;
}
