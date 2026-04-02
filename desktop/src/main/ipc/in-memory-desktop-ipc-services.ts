import type {
  AsrModelCatalogItem,
  DesktopErrorCode,
  InstalledAsrModel,
  ProviderSummary,
  RecognitionStrategy,
  RuntimeSnapshot,
  Utterance
} from "@ai-emotion/contracts";
import { createAsrWorker, AsrWorkerError, type WhisperRunner } from "../../runtime/asr/asr-worker";
import { listAsrModelCatalog } from "../../runtime/asr/model-catalog";
import { createRuntimeEventBus } from "./runtime-bus";
import type { DesktopIpcServices } from "./desktop-ipc-services";

type InMemoryRuntimeState = {
  listening: boolean;
  recognitionStrategy: RecognitionStrategy;
  installedModels: InstalledAsrModel[];
  providers: ProviderSummary[];
  utterances: Utterance[];
  errorsTotal: number;
};

const asrCatalog: AsrModelCatalogItem[] = listAsrModelCatalog().map((entry) => ({
  modelId: entry.modelId,
  name: entry.name,
  language: entry.language,
  sizeBytes: entry.sizeBytes,
  recommended: entry.recommended
}));

let defaultServices: DesktopIpcServices | undefined;

function createSnapshot(state: InMemoryRuntimeState): RuntimeSnapshot {
  return {
    status: { listening: state.listening },
    metrics: {
      uptime_seconds: 0,
      ws_clients: 0,
      utterances_total: state.utterances.length,
      emotion_total: 0,
      errors_total: state.errorsTotal
    },
    utterances: state.utterances.map((utterance) => ({ ...utterance }))
  };
}

export type CreateInMemoryDesktopIpcServicesOptions = {
  runner?: WhisperRunner;
};

export function createInMemoryDesktopIpcServices(
  options: CreateInMemoryDesktopIpcServicesOptions = {}
): DesktopIpcServices {
  const runtimeEventBus = createRuntimeEventBus();
  const state: InMemoryRuntimeState = {
    listening: false,
    recognitionStrategy: { mode: "auto" },
    installedModels: [],
    providers: [],
    utterances: [],
    errorsTotal: 0
  };
  const asrWorker = createAsrWorker({
    modelStore: {
      getModelsRootPath() {
        return "/tmp/asr-models";
      },
      async listInstalledModels() {
        return state.installedModels.map((model) => ({ ...model }));
      },
      async getActiveModelId() {
        return state.installedModels.find((model) => model.active)?.modelId ?? null;
      },
      async activateModel(modelId) {
        if (!state.installedModels.some((model) => model.modelId === modelId)) {
          throw new AsrWorkerError(
            "ASR_MODEL_NOT_INSTALLED",
            `Model ${modelId} is not installed`
          );
        }

        state.installedModels = state.installedModels.map((model) => ({
          ...model,
          active: model.modelId === modelId
        }));
      }
    },
    runner: options.runner,
    onFinalTranscript(input) {
      const utterance: Utterance = {
        id: input.segmentId,
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
        final_text: input.text,
        partial_text: null,
        emotion: null,
        emotion_status: "queued",
        latency_ms: null
      };

      state.utterances = [...state.utterances, utterance];
      runtimeEventBus.publish({
        type: "runtime:utterance",
        payload: utterance
      });
    }
  });

  return {
    session: {
      async startListening() {
        await asrWorker.startListening();
        state.listening = true;
        runtimeEventBus.publish({
          type: "runtime:status",
          payload: { listening: true }
        });
      },
      async stopListening() {
        await asrWorker.stopListening();
        state.listening = false;
        runtimeEventBus.publish({
          type: "runtime:status",
          payload: { listening: false }
        });
      },
      async handleCapturePcmFrame(frame) {
        await asrWorker.handlePcmFrame(frame);
      }
    },
    runtime: {
      async getSnapshot() {
        return createSnapshot(state);
      },
      publishError(code: DesktopErrorCode, message: string) {
        state.errorsTotal += 1;
        runtimeEventBus.publish({
          type: "runtime:error",
          payload: { code, message }
        });
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
        await asrWorker.switchModel(modelId);
      },
      async deleteModel(modelId) {
        state.installedModels = state.installedModels.filter((item) => item.modelId !== modelId);
      },
      async getRecognitionStrategy() {
        return state.recognitionStrategy;
      },
      async updateRecognitionStrategy(input) {
        state.recognitionStrategy = await asrWorker.updateRecognitionStrategy(input);
        runtimeEventBus.publish({
          type: "asr:recognition-strategy",
          payload: state.recognitionStrategy
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
