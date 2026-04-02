import { describe, expect, test, vi } from "vitest";
import type { RecognitionStrategy } from "@ai-emotion/contracts";
import { AsrWorkerError, createAsrWorker, type WhisperRunner } from "../../../runtime/asr/asr-worker";

function createModelStoreStub(input?: {
  activeModelId?: string | null;
  installedModels?: { modelId: string; active: boolean }[];
}) {
  const activeModelId = input?.activeModelId ?? null;
  const installedModels =
    input?.installedModels?.map((model) => ({
      modelId: model.modelId,
      installedAt: "2026-04-01T00:00:00.000Z",
      sizeBytes: 123,
      active: model.active
    })) ?? [];

  return {
    getModelsRootPath: vi.fn(() => "/tmp/asr-models"),
    listInstalledModels: vi.fn(async () => installedModels),
    getActiveModelId: vi.fn(async () => activeModelId),
    activateModel: vi.fn(async () => undefined)
  };
}

function createRunnerStub(output = "hello world"): WhisperRunner {
  return {
    loadModel: vi.fn(async () => undefined),
    transcribe: vi.fn(async () => output),
    reset: vi.fn()
  };
}

describe("asr worker task-8 behavior", () => {
  test("listening start is blocked when no ready model exists", async () => {
    const modelStore = createModelStoreStub({
      activeModelId: null,
      installedModels: []
    });
    const worker = createAsrWorker({
      modelStore,
      runner: createRunnerStub()
    });

    await expect(worker.startListening()).rejects.toMatchObject({
      code: "ASR_MODEL_NOT_INSTALLED"
    });
  });

  test("recognition strategy rejects unsupported fixed language", async () => {
    const modelStore = createModelStoreStub();
    const worker = createAsrWorker({
      modelStore,
      runner: createRunnerStub()
    });

    await expect(
      worker.updateRecognitionStrategy({
        mode: "fixed",
        fixedLanguage: "ja"
      } as unknown as RecognitionStrategy)
    ).rejects.toBeInstanceOf(AsrWorkerError);

    await expect(
      worker.updateRecognitionStrategy({
        mode: "fixed",
        fixedLanguage: "ja"
      } as unknown as RecognitionStrategy)
    ).rejects.toMatchObject({
      code: "ASR_INVALID_RECOGNITION_STRATEGY"
    });
  });

  test("pcm frames from capture bridge produce one finalized transcript event when segment closes", async () => {
    const finalizedListener = vi.fn();
    const modelStore = createModelStoreStub({
      activeModelId: "whisper-base",
      installedModels: [{ modelId: "whisper-base", active: true }]
    });
    const worker = createAsrWorker({
      modelStore,
      runner: createRunnerStub("final transcript"),
      onFinalTranscript: finalizedListener
    });

    await worker.startListening();
    await worker.handlePcmFrame({
      segmentId: "segment-1",
      samples: Float32Array.from([0.25, -0.1, 0.0]),
      sampleRate: 16_000,
      isFinal: false
    });
    await worker.handlePcmFrame({
      segmentId: "segment-1",
      samples: Float32Array.from([0.4, 0.1]),
      sampleRate: 16_000,
      isFinal: true
    });

    expect(finalizedListener).toHaveBeenCalledTimes(1);
    expect(finalizedListener).toHaveBeenCalledWith(
      expect.objectContaining({
        segmentId: "segment-1",
        text: "final transcript",
        isFinal: true
      })
    );
  });

  test("switching model while listening returns ASR_MODEL_SWITCH_BLOCKED_WHILE_LISTENING", async () => {
    const modelStore = createModelStoreStub({
      activeModelId: "whisper-base",
      installedModels: [{ modelId: "whisper-base", active: true }]
    });
    const worker = createAsrWorker({
      modelStore,
      runner: createRunnerStub()
    });

    await worker.startListening();

    await expect(worker.switchModel("whisper-small")).rejects.toMatchObject({
      code: "ASR_MODEL_SWITCH_BLOCKED_WHILE_LISTENING"
    });
  });
});
