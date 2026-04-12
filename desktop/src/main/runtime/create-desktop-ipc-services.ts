import type {
  AsrModelCatalogItem,
  DesktopErrorCode,
  RecognitionStrategy,
  RuntimeSnapshot
} from "@ai-emotion/contracts";
import { isDesktopErrorCode } from "@ai-emotion/contracts";
import { createAppConfigStore, type ElectronAppPathAdapter } from "../../runtime/config/app-config-store";
import { createDownloadManager } from "../../runtime/asr/download-manager";
import { listAsrModelCatalog } from "../../runtime/asr/model-catalog";
import { createModelStore } from "../../runtime/asr/model-store";
import type { WhisperRunner } from "../../runtime/asr/asr-worker";
import { createAsrSessionService } from "../../runtime/asr/asr-session-service";
import { createCaptureFrameSource, type CaptureFrameSource } from "../../runtime/asr/capture-frame-source";
import {
  EmotionTaskQueue,
  QUEUE_POLICY_LATEST
} from "../../runtime/emotion/emotion-queue";
import { EmotionService } from "../../runtime/emotion/emotion-service";
import { EmotionWorker } from "../../runtime/emotion/emotion-worker";
import { OscService } from "../../runtime/osc/osc-service";
import { ProviderCrypto } from "../../runtime/providers/provider-crypto";
import { SqliteProviderRepository } from "../../runtime/providers/provider-repository";
import { ProviderService } from "../../runtime/providers/provider-service";
import {
  createInMemoryDesktopIpcServices,
  type CreateInMemoryDesktopIpcServicesOptions
} from "../ipc/in-memory-desktop-ipc-services";
import { createRuntimeEventBus } from "../ipc/runtime-bus";
import type { DesktopIpcServices } from "../ipc/desktop-ipc-services";
import {
  DESKTOP_RUNTIME_MODE_ENV,
  type DesktopRuntimeMode,
  resolveDesktopRuntimeMode
} from "./desktop-runtime-mode";

const DEFAULT_PROVIDER_MODEL = "llama3.1:8b";
const PROVIDER_SECRET_KEY_ENV = "AI_EMOTION_PROVIDER_SECRET_KEY";
const DEFAULT_EMOTION_PROMPT = [
  "Analyze the emotional tone of the user text.",
  "Return JSON only with keys dominant_emotion, brief_explanation, and dimensions.",
  "dimensions must include joy, trust, fear, surprise, sadness, disgust, anger, anticipation as numbers from 0 to 1.",
  "Text: {{USER_TEXT}}"
].join("\n");

let defaultServicesPromise: Promise<DesktopIpcServices> | null = null;

export type CreateDesktopIpcServicesOptions = {
  mode?: DesktopRuntimeMode;
  env?: NodeJS.ProcessEnv;
  app?: ElectronAppPathAdapter;
  runner?: WhisperRunner;
  fetchImpl?: typeof fetch;
  captureSource?: CaptureFrameSource;
  inMemory?: CreateInMemoryDesktopIpcServicesOptions;
  promptTemplate?: string;
  now?: () => Date;
  nowIso?: () => string;
  nowMs?: () => number;
};

export async function createDesktopIpcServices(
  options: CreateDesktopIpcServicesOptions = {}
): Promise<DesktopIpcServices> {
  const mode = options.mode ?? resolveDesktopRuntimeMode(options.env);
  if (mode === "in-memory") {
    return createInMemoryDesktopIpcServices({
      ...options.inMemory,
      runner: options.runner ?? options.inMemory?.runner,
      captureSource: options.captureSource ?? options.inMemory?.captureSource
    });
  }

  return createRealDesktopIpcServices(options);
}

export async function getDefaultDesktopIpcServices(
  options: CreateDesktopIpcServicesOptions = {}
): Promise<DesktopIpcServices> {
  defaultServicesPromise ??= createDesktopIpcServices(options);
  return defaultServicesPromise;
}

export function resetDefaultDesktopIpcServicesForTests(): void {
  defaultServicesPromise = null;
}

async function createRealDesktopIpcServices(
  options: CreateDesktopIpcServicesOptions
): Promise<DesktopIpcServices> {
  const now = options.now ?? (() => new Date());
  const nowIso = options.nowIso ?? (() => now().toISOString());
  const nowMs = options.nowMs ?? (() => Date.now());
  const appConfigStore = createAppConfigStore({
    app: options.app
  });
  const runtimeEventBus = createRuntimeEventBus(createInitialSnapshot());
  const modelStore = createModelStore({
    appConfigStore,
    now
  });
  const providerRepository = new SqliteProviderRepository(
    appConfigStore.getPaths().providerDbPath
  );
  await providerRepository.initialize(DEFAULT_PROVIDER_MODEL);

  const providerSecretKey = resolveProviderSecretKey(options.env);
  const providerService = new ProviderService({
    repository: providerRepository,
    crypto: new ProviderCrypto(providerSecretKey)
  });

  const config = await appConfigStore.read();
  const emotionQueue = new EmotionTaskQueue(QUEUE_POLICY_LATEST, 1);
  const captureSource = options.captureSource ?? createCaptureFrameSource();
  const osc = new OscService({
    host: config.osc.host,
    port: config.osc.port
  });
  const emotionService = new EmotionService({
    providerService,
    promptTemplate: options.promptTemplate ?? DEFAULT_EMOTION_PROMPT
  });
  const session = createAsrSessionService({
    modelStore,
    captureSource,
    emotionQueue,
    runtime: runtimeEventBus,
    runner: options.runner,
    now: nowIso,
    nowMs
  });
  await session.updateRecognitionStrategy(readRecognitionStrategy(config));

  const publishRuntimeError = createRuntimeErrorPublisher(runtimeEventBus);
  const emotionWorker = new EmotionWorker({
    queue: emotionQueue,
    service: emotionService,
    osc,
    onStarted({ utteranceId }) {
      session.handleEmotionStarted({ utteranceId });
    },
    onResult({ utteranceId, result }) {
      session.handleEmotionResult({ utteranceId, result });
    },
    onFailed({ utteranceId, error }) {
      session.handleEmotionFailure({ utteranceId });
      const runtimeError = toRuntimeErrorPayload(error);
      publishRuntimeError(runtimeError.code, runtimeError.message);
    },
    onSuperseded({ utteranceId }) {
      session.handleEmotionSuperseded({ utteranceId });
    }
  });
  emotionWorker.start();

  const downloadManager = createDownloadManager({
    modelStore,
    fetchImpl: options.fetchImpl,
    runtimeEventBus
  });

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
      publishError(code, message) {
        publishRuntimeError(code, message);
      },
      subscribe(listener) {
        return runtimeEventBus.subscribe(listener);
      }
    },
    asr: {
      async listCatalog() {
        return listAsrModelCatalog().map<AsrModelCatalogItem>((entry) => ({
          modelId: entry.modelId,
          name: entry.name,
          language: entry.language,
          sizeBytes: entry.sizeBytes,
          recommended: entry.recommended
        }));
      },
      async listInstalled() {
        return modelStore.listInstalledModels();
      },
      async downloadModel(modelId) {
        await downloadManager.downloadModel(modelId);
      },
      async activateModel(modelId) {
        await session.switchModel(modelId);
      },
      async deleteModel(modelId) {
        await modelStore.deleteModel(modelId);
      },
      async getRecognitionStrategy() {
        return session.getRecognitionStrategy();
      },
      async updateRecognitionStrategy(input) {
        const nextStrategy = await session.updateRecognitionStrategy(input);
        await appConfigStore.updateAsr((current) => ({
          ...current,
          languageMode: nextStrategy.mode,
          fixedLanguage:
            nextStrategy.mode === "fixed" ? nextStrategy.fixedLanguage : null
        }));
        runtimeEventBus.publish({
          type: "asr:recognition-strategy",
          payload: nextStrategy
        });
        return nextStrategy;
      }
    },
    providers: {
      async list() {
        return {
          providers: await providerService.listSummaries()
        };
      },
      async create(input) {
        const created = await providerService.createProvider(input);
        await publishProviderList(runtimeEventBus, providerService);
        return created;
      },
      async update(providerId, patch) {
        const updated = await providerService.updateProvider(providerId, patch);
        await publishProviderList(runtimeEventBus, providerService);
        return updated;
      },
      async delete(providerId) {
        await providerService.deleteProvider(providerId);
        await publishProviderList(runtimeEventBus, providerService);
      },
      async test(providerId) {
        return providerService.testProvider(providerId);
      },
      async activate(providerId) {
        await providerService.activateProvider(providerId);
        await publishProviderList(runtimeEventBus, providerService);
      }
    },
    async dispose() {
      await session.stopListening().catch(() => undefined);
      await emotionWorker.stop().catch(() => undefined);
      await osc.close().catch(() => undefined);
    }
  };
}

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

function readRecognitionStrategy(config: {
  asr: { languageMode: "auto" | "fixed"; fixedLanguage: "zh" | "en" | null };
}): RecognitionStrategy {
  if (config.asr.languageMode === "fixed" && config.asr.fixedLanguage) {
    return {
      mode: "fixed",
      fixedLanguage: config.asr.fixedLanguage
    };
  }

  return { mode: "auto" };
}

function resolveProviderSecretKey(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env[PROVIDER_SECRET_KEY_ENV]?.trim();
  if (configured) {
    return configured;
  }

  throw new Error(`${PROVIDER_SECRET_KEY_ENV} is required for desktop runtime mode`);
}

async function publishProviderList(
  runtimeEventBus: ReturnType<typeof createRuntimeEventBus>,
  providerService: ProviderService
): Promise<void> {
  const providers = await providerService.listSummaries();
  runtimeEventBus.publish({
    type: "providers:list",
    payload: { providers }
  });
}

function createRuntimeErrorPublisher(
  runtimeEventBus: ReturnType<typeof createRuntimeEventBus>
): (code: DesktopErrorCode, message: string) => void {
  return (code, message) => {
    const snapshot = runtimeEventBus.getSnapshot();
    const nextSnapshot = runtimeEventBus.setSnapshot({
      ...snapshot,
      metrics: {
        ...snapshot.metrics,
        errors_total: snapshot.metrics.errors_total + 1
      }
    });

    runtimeEventBus.publish({
      type: "runtime:metrics",
      payload: nextSnapshot.metrics
    });
    runtimeEventBus.publish({
      type: "runtime:error",
      payload: { code, message }
    });
  };
}

function toRuntimeErrorPayload(error: unknown): {
  code: DesktopErrorCode;
  message: string;
} {
  const message = error instanceof Error ? error.message : "Desktop runtime failed";
  const candidateCode =
    error && typeof error === "object" && "code" in error
      ? (error as { code?: unknown }).code
      : null;

  if (typeof candidateCode === "string" && isDesktopErrorCode(candidateCode)) {
    return {
      code: candidateCode,
      message
    };
  }

  return {
    code: "PROVIDER_UPSTREAM_UNAVAILABLE",
    message
  };
}

export {
  DEFAULT_EMOTION_PROMPT,
  DEFAULT_PROVIDER_MODEL,
  DESKTOP_RUNTIME_MODE_ENV,
  PROVIDER_SECRET_KEY_ENV,
  resolveProviderSecretKey,
  resolveDesktopRuntimeMode
};
