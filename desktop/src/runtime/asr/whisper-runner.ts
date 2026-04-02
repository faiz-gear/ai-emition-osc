import { join } from "node:path";
import type { RecognitionStrategy } from "@ai-emotion/contracts";

type WhisperPipelineLike = (
  audio: Float32Array,
  options?: Record<string, unknown>
) => Promise<{ text?: unknown } | string>;

type TransformersRuntime = {
  pipeline(
    task: "automatic-speech-recognition",
    modelPath: string,
    options: Record<string, unknown>
  ): Promise<WhisperPipelineLike>;
};

export type WhisperRunnerLoadInput = {
  modelId: string;
  modelsRootPath: string;
  recognitionStrategy: RecognitionStrategy;
};

export type WhisperTranscribeInput = {
  samples: Float32Array;
  sampleRate: number;
  recognitionStrategy: RecognitionStrategy;
};

export type WhisperRunner = {
  loadModel(input: WhisperRunnerLoadInput): Promise<void>;
  transcribe(input: WhisperTranscribeInput): Promise<string>;
  reset(): void;
};

export class WhisperRunnerError extends Error {
  public constructor(public readonly code: "ASR_RECOGNITION_FAILED", message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "WhisperRunnerError";
  }
}

export function createWhisperRunner(options: {
  runtimeLoader?: () => Promise<TransformersRuntime>;
} = {}): WhisperRunner {
  const runtimeLoader = options.runtimeLoader ?? loadTransformersRuntime;
  let activeModelPath: string | null = null;
  let transcriber: WhisperPipelineLike | null = null;

  return {
    async loadModel(input) {
      const requestedModelPath = join(input.modelsRootPath, input.modelId);
      if (transcriber && activeModelPath === requestedModelPath) {
        return;
      }

      const runtime = await runtimeLoader();
      transcriber = await runtime.pipeline("automatic-speech-recognition", requestedModelPath, {
        local_files_only: true,
        quantized: true
      });
      activeModelPath = requestedModelPath;
    },
    async transcribe(input) {
      if (!transcriber) {
        throw new WhisperRunnerError("ASR_RECOGNITION_FAILED", "Whisper runner has no active model");
      }

      try {
        const result = await transcriber(input.samples, {
          sampling_rate: input.sampleRate,
          language: resolveLanguage(input.recognitionStrategy),
          return_timestamps: false
        });
        return normalizeTranscript(result);
      } catch (error) {
        throw new WhisperRunnerError(
          "ASR_RECOGNITION_FAILED",
          "Whisper transcription failed",
          { cause: error }
        );
      }
    },
    reset() {
      activeModelPath = null;
      transcriber = null;
    }
  };
}

async function loadTransformersRuntime(): Promise<TransformersRuntime> {
  const [transformersModule, onnxRuntimeModule] = await Promise.all([
    import("@huggingface/transformers"),
    import("onnxruntime-node")
  ]);

  void onnxRuntimeModule;

  if ("env" in transformersModule && typeof transformersModule.env === "object" && transformersModule.env) {
    const env = transformersModule.env as {
      allowLocalModels?: boolean;
      allowRemoteModels?: boolean;
    };
    env.allowLocalModels = true;
    env.allowRemoteModels = false;
  }

  return {
    pipeline: transformersModule.pipeline
  };
}

function resolveLanguage(strategy: RecognitionStrategy): string | undefined {
  if (strategy.mode === "fixed") {
    return strategy.fixedLanguage;
  }

  return undefined;
}

function normalizeTranscript(output: { text?: unknown } | string): string {
  if (typeof output === "string") {
    return output.trim();
  }

  if (typeof output.text === "string") {
    return output.text.trim();
  }

  return "";
}
