import { isRecognitionStrategy, type RecognitionStrategy } from "@ai-emotion/contracts";
import { createWhisperRunner, type WhisperRunner } from "./whisper-runner";

type InstalledModel = {
  modelId: string;
  active: boolean;
};

type AsrWorkerModelStore = {
  getModelsRootPath(): string;
  listInstalledModels(): Promise<InstalledModel[]>;
  getActiveModelId(): Promise<string | null>;
  activateModel(modelId: string): Promise<unknown>;
};

export type PcmFrame = {
  segmentId: string;
  samples: Float32Array;
  sampleRate: number;
  isFinal: boolean;
};

export type FinalTranscriptEvent = {
  segmentId: string;
  modelId: string;
  text: string;
  language: "auto" | "zh" | "en";
  sampleRate: number;
  isFinal: true;
};

type AsrWorkerOptions = {
  modelStore: AsrWorkerModelStore;
  runner?: WhisperRunner;
  onFinalTranscript?: (event: FinalTranscriptEvent) => Promise<void> | void;
};

type SegmentBuffer = {
  sampleRate: number;
  chunks: Float32Array[];
};

export class AsrWorkerError extends Error {
  public constructor(public readonly code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AsrWorkerError";
  }
}

export type AsrWorker = {
  startListening(): Promise<void>;
  stopListening(): Promise<void>;
  switchModel(modelId: string): Promise<void>;
  updateRecognitionStrategy(input: RecognitionStrategy): Promise<RecognitionStrategy>;
  handlePcmFrame(frame: PcmFrame): Promise<void>;
  getRecognitionStrategy(): RecognitionStrategy;
  isListening(): boolean;
};

export function createAsrWorker(options: AsrWorkerOptions): AsrWorker {
  const runner = options.runner ?? createWhisperRunner();
  let recognitionStrategy: RecognitionStrategy = { mode: "auto" };
  let listening = false;
  let loadedModelId: string | null = null;
  const segments = new Map<string, SegmentBuffer>();
  const finalizedSegments = new Set<string>();

  async function resolveReadyModelId(): Promise<string> {
    const [activeModelId, installedModels] = await Promise.all([
      options.modelStore.getActiveModelId(),
      options.modelStore.listInstalledModels()
    ]);

    const byId = activeModelId
      ? installedModels.find((model) => model.modelId === activeModelId)
      : undefined;
    const readyModel = byId ?? installedModels.find((model) => model.active);
    if (!readyModel) {
      throw new AsrWorkerError(
        "ASR_MODEL_NOT_INSTALLED",
        "Listening requires one ready ASR model"
      );
    }
    return readyModel.modelId;
  }

  async function ensureRunner(modelId: string): Promise<void> {
    if (loadedModelId === modelId) {
      return;
    }

    await runner.loadModel({
      modelId,
      modelsRootPath: options.modelStore.getModelsRootPath(),
      recognitionStrategy
    });
    loadedModelId = modelId;
  }

  return {
    async startListening() {
      if (listening) {
        return;
      }

      const modelId = await resolveReadyModelId();
      await ensureRunner(modelId);
      listening = true;
    },
    async stopListening() {
      listening = false;
      segments.clear();
      finalizedSegments.clear();
    },
    async switchModel(modelId) {
      if (listening) {
        throw new AsrWorkerError(
          "ASR_MODEL_SWITCH_BLOCKED_WHILE_LISTENING",
          "Model switching is disabled while listening"
        );
      }

      await options.modelStore.activateModel(modelId);
      loadedModelId = null;
      runner.reset();
    },
    async updateRecognitionStrategy(input) {
      if (!isRecognitionStrategy(input)) {
        throw new AsrWorkerError(
          "ASR_INVALID_RECOGNITION_STRATEGY",
          "Recognition strategy is invalid"
        );
      }

      recognitionStrategy = input;
      return recognitionStrategy;
    },
    async handlePcmFrame(frame) {
      if (!listening) {
        return;
      }

      if (finalizedSegments.has(frame.segmentId)) {
        return;
      }

      const segment = segments.get(frame.segmentId) ?? {
        sampleRate: frame.sampleRate,
        chunks: []
      };
      segment.chunks.push(frame.samples);
      segments.set(frame.segmentId, segment);

      if (!frame.isFinal) {
        return;
      }

      finalizedSegments.add(frame.segmentId);
      segments.delete(frame.segmentId);

      const modelId = loadedModelId ?? (await resolveReadyModelId());
      const text = (
        await runner.transcribe({
          samples: mergeChunks(segment.chunks),
          sampleRate: segment.sampleRate,
          recognitionStrategy
        })
      ).trim();

      if (text.length === 0) {
        return;
      }

      await options.onFinalTranscript?.({
        segmentId: frame.segmentId,
        modelId,
        text,
        language: recognitionStrategy.mode === "fixed" ? recognitionStrategy.fixedLanguage : "auto",
        sampleRate: segment.sampleRate,
        isFinal: true
      });
    },
    getRecognitionStrategy() {
      return recognitionStrategy;
    },
    isListening() {
      return listening;
    }
  };
}

function mergeChunks(chunks: Float32Array[]): Float32Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

export type { WhisperRunner } from "./whisper-runner";
