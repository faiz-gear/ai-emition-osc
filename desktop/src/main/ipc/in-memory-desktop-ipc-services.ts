import type {
  AsrModelCatalogItem,
  DesktopErrorCode,
  EmotionResult,
  InstalledAsrModel,
  ProviderSummary,
  RecognitionStrategy,
  RuntimeSnapshot
} from "@ai-emotion/contracts";
import { AsrWorkerError, type WhisperRunner } from "../../runtime/asr/asr-worker";
import { createAsrSessionService } from "../../runtime/asr/asr-session-service";
import { listAsrModelCatalog } from "../../runtime/asr/model-catalog";
import {
  EmotionTaskQueue,
  QUEUE_POLICY_LATEST
} from "../../runtime/emotion/emotion-queue";
import type { EmotionService } from "../../runtime/emotion/emotion-service";
import { EmotionWorker } from "../../runtime/emotion/emotion-worker";
import type { OscService } from "../../runtime/osc/osc-service";
import { createRuntimeEventBus } from "./runtime-bus";
import type { DesktopIpcServices } from "./desktop-ipc-services";

type InMemoryRuntimeState = {
  recognitionStrategy: RecognitionStrategy;
  installedModels: InstalledAsrModel[];
  providers: ProviderSummary[];
};

const asrCatalog: AsrModelCatalogItem[] = listAsrModelCatalog().map((entry) => ({
  modelId: entry.modelId,
  name: entry.name,
  language: entry.language,
  sizeBytes: entry.sizeBytes,
  recommended: entry.recommended
}));

let defaultServices: DesktopIpcServices | undefined;

function createInitialSnapshot(): RuntimeSnapshot {
  return {
    status: { listening: false },
    metrics: {
      uptime_seconds: 0,
      ws_clients: 0,
      utterances_total: 0,
      emotion_total: 0,
      emotion_queue_depth: 0,
      errors_total: 0
    },
    utterances: []
  };
}

export type CreateInMemoryDesktopIpcServicesOptions = {
  runner?: WhisperRunner;
  emotionService?: Pick<EmotionService, "analyzeText">;
  osc?: Pick<OscService, "sendEmotion" | "close">;
};

export function createInMemoryDesktopIpcServices(
  options: CreateInMemoryDesktopIpcServicesOptions = {}
): DesktopIpcServices {
  const runtimeEventBus = createRuntimeEventBus(createInitialSnapshot());
  const state: InMemoryRuntimeState = {
    recognitionStrategy: { mode: "auto" },
    installedModels: [],
    providers: []
  };
  const emotionQueue = new EmotionTaskQueue(QUEUE_POLICY_LATEST, 1);
  const emotionService = options.emotionService ?? createNeutralEmotionService();
  const osc = options.osc ?? createNoopOscService();
  const session = createAsrSessionService({
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
    emotionQueue,
    runtime: runtimeEventBus
  });
  const emotionWorker = new EmotionWorker({
    queue: emotionQueue,
    service: emotionService as EmotionService,
    osc: osc as OscService,
    onStarted({ utteranceId }) {
      session.handleEmotionStarted({ utteranceId });
    },
    onResult({ utteranceId, result }) {
      session.handleEmotionResult({ utteranceId, result });
    },
    onFailed({ utteranceId }) {
      session.handleEmotionFailure({ utteranceId });
    }
  });
  emotionWorker.start();

  return {
    session: {
      async startListening() {
        await session.startListening();
      },
      async stopListening() {
        await session.stopListening();
      },
      async handleCapturePcmFrame(frame) {
        await session.handleCapturePcmFrame(frame);
      }
    },
    runtime: {
      async getSnapshot() {
        return runtimeEventBus.getSnapshot();
      },
      publishError(code: DesktopErrorCode, message: string) {
        const snapshot = runtimeEventBus.getSnapshot();
        runtimeEventBus.setSnapshot({
          ...snapshot,
          metrics: {
            ...snapshot.metrics,
            errors_total: snapshot.metrics.errors_total + 1
          }
        });
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
        await session.switchModel(modelId);
      },
      async deleteModel(modelId) {
        state.installedModels = state.installedModels.filter((item) => item.modelId !== modelId);
      },
      async getRecognitionStrategy() {
        return session.getRecognitionStrategy();
      },
      async updateRecognitionStrategy(input) {
        state.recognitionStrategy = await session.updateRecognitionStrategy(input);
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

function createNeutralEmotionService(): Pick<EmotionService, "analyzeText"> {
  const result: EmotionResult = {
    dominant_emotion: "neutral",
    brief_explanation: "",
    dimensions: {
      joy: 0,
      trust: 0,
      fear: 0,
      surprise: 0,
      sadness: 0,
      disgust: 0,
      anger: 0,
      anticipation: 0
    }
  };

  return {
    async analyzeText() {
      return result;
    }
  };
}

function createNoopOscService(): Pick<OscService, "sendEmotion" | "close"> {
  return {
    async sendEmotion() {},
    close() {}
  };
}
