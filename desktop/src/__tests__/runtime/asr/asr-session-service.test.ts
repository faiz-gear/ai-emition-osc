import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  DesktopCommand,
  type EmotionResult,
  type RuntimeEvent
} from "@ai-emotion/contracts";
import { createAudioWorkletBridge } from "../../../capture/audio-worklet-bridge";
import { registerIpc } from "../../../main/ipc/register-ipc";
import { createInMemoryDesktopIpcServices } from "../../../main/ipc/in-memory-desktop-ipc-services";
import { createCaptureBridge } from "../../../preload/desktop-api";
import type { WhisperRunner } from "../../../runtime/asr/asr-worker";
import { createCaptureFrameSource } from "../../../runtime/asr/capture-frame-source";
import { CAPTURE_PCM_CHANNEL } from "../../../runtime/asr/capture-ipc";
import type { EmotionService } from "../../../runtime/emotion/emotion-service";
import type { OscService } from "../../../runtime/osc/osc-service";

const { browserWindowGetAllWindowsMock, destroyCaptureWindowMock, ensureCaptureWindowMock, handleMock, ipcMainOnMock } = vi.hoisted(() => ({
  browserWindowGetAllWindowsMock: vi.fn(() => []),
  destroyCaptureWindowMock: vi.fn(),
  ensureCaptureWindowMock: vi.fn(),
  handleMock: vi.fn(),
  ipcMainOnMock: vi.fn()
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: handleMock,
    on: ipcMainOnMock
  },
  BrowserWindow: {
    getAllWindows: browserWindowGetAllWindowsMock
  }
}));

vi.mock("../../../main/windows/capture-window-runtime", () => ({
  destroyCaptureWindow: destroyCaptureWindowMock,
  ensureCaptureWindow: ensureCaptureWindowMock
}));

function createRunnerStub(output = "hello world"): WhisperRunner {
  return {
    loadModel: vi.fn(async () => undefined),
    transcribe: vi.fn(async () => output),
    reset: vi.fn()
  };
}

async function invokeValidated(command: DesktopCommand, payload?: unknown): Promise<unknown> {
  const registration = handleMock.mock.calls.find(([channel]) => channel === command);
  expect(registration, `Missing registration for ${command}`).toBeTruthy();
  const [, handler] = registration as [DesktopCommand, (_event: unknown, input?: unknown) => Promise<unknown>];
  return handler({} as unknown, payload);
}

function getCaptureListener(): (event: unknown, payload: unknown) => void {
  const captureRegistration = ipcMainOnMock.mock.calls.find(([channel]) => channel === CAPTURE_PCM_CHANNEL);
  expect(captureRegistration, "Missing capture IPC listener registration").toBeTruthy();
  const [, listener] = captureRegistration as [string, (event: unknown, payload: unknown) => void];
  return listener;
}

function createEmotionResult(
  dominantEmotion = "joy",
  briefExplanation = "detected from transcript"
): EmotionResult {
  return {
    dominant_emotion: dominantEmotion,
    brief_explanation: briefExplanation,
    dimensions: {
      joy: 0.9,
      trust: 0.2,
      fear: 0.1,
      surprise: 0.3,
      sadness: 0.1,
      disgust: 0.1,
      anger: 0.1,
      anticipation: 0.4
    }
  };
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return {
    promise,
    resolve,
    reject
  };
}

describe("task-9 asr session orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    browserWindowGetAllWindowsMock.mockReturnValue([]);
  });

  test("listening start is blocked when no ready model exists", async () => {
    const services = createInMemoryDesktopIpcServices({ runner: createRunnerStub() });
    registerIpc(services);

    await expect(invokeValidated(DesktopCommand.StartListening)).rejects.toMatchObject({
      code: "ASR_MODEL_NOT_INSTALLED"
    });
  });

  test("recognition strategy rejects unsupported fixed language", async () => {
    const services = createInMemoryDesktopIpcServices({ runner: createRunnerStub() });
    registerIpc(services);

    await expect(
      invokeValidated(DesktopCommand.UpdateRecognitionStrategy, {
        mode: "fixed",
        fixedLanguage: "ja"
      })
    ).rejects.toThrow(/invalid/i);
  });

  test("startListening publishes status, final transcripts enqueue emotion analysis, emotion events are ordered, and stopListening closes cleanly", async () => {
    const emotionResult = createEmotionResult();
    const emotionService = {
      analyzeText: vi.fn(async () => emotionResult)
    } satisfies Pick<EmotionService, "analyzeText">;
    const osc = {
      sendEmotion: vi.fn(async () => undefined),
      close: vi.fn()
    } satisfies Pick<OscService, "sendEmotion" | "close">;
    const captureSource = createCaptureFrameSource();
    const services = createInMemoryDesktopIpcServices({
      runner: createRunnerStub("final transcript"),
      captureSource,
      emotionService,
      osc
    } as Parameters<typeof createInMemoryDesktopIpcServices>[0]);
    const runtimeEvents: Array<RuntimeEvent | { type: string; payload: unknown }> = [];
    const unsubscribe = services.runtime.subscribe((event) => {
      runtimeEvents.push(event);
    });
    registerIpc(services);

    await invokeValidated(DesktopCommand.DownloadAsrModel, { modelId: "whisper-base" });
    await invokeValidated(DesktopCommand.StartListening);

    await vi.waitFor(() => {
      expect(runtimeEvents).toContainEqual({
        type: "session:status",
        payload: { listening: true }
      });
    });
    expect(captureSource.getSubscriberCount()).toBe(1);
    expect(runtimeEvents).toContainEqual({
      type: "runtime:snapshot",
      payload: expect.objectContaining({
        status: { listening: true }
      })
    });

    const captureListener = getCaptureListener();
    const captureBridge = createCaptureBridge({
      postMessage(channel, message) {
        expect(channel).toBe(CAPTURE_PCM_CHANNEL);
        captureListener({ sender: null }, message);
      }
    });
    const workletBridge = createAudioWorkletBridge({ captureBridge });

    workletBridge.forward({
      segmentId: "segment-1",
      samples: Float32Array.from([0.25, -0.1, 0]),
      sampleRate: 16_000,
      isFinal: false
    });
    workletBridge.forward({
      segmentId: "segment-1",
      samples: Float32Array.from([0.4, 0.1]),
      sampleRate: 16_000,
      isFinal: true
    });

    await vi.waitFor(() => {
      const eventTypes = runtimeEvents.map((event) => event.type);
      expect(eventTypes).toContain("runtime:utterance");
      expect(eventTypes).toContain("emotion:started");
      expect(eventTypes).toContain("emotion:result");
    });

    const [utteranceEvent] = runtimeEvents.filter((event) => event.type === "runtime:utterance");
    expect(utteranceEvent).toMatchObject({
      type: "runtime:utterance",
      payload: {
        final_text: "final transcript",
        emotion_status: "queued"
      }
    });
    expect(emotionService.analyzeText).toHaveBeenCalledWith("final transcript");
    expect(osc.sendEmotion).toHaveBeenCalledWith(emotionResult.dimensions);

    const startedIndex = runtimeEvents.findIndex((event) => event.type === "emotion:started");
    const resultIndex = runtimeEvents.findIndex((event) => event.type === "emotion:result");
    expect(startedIndex).toBeGreaterThan(-1);
    expect(resultIndex).toBeGreaterThan(startedIndex);
    expect(runtimeEvents[resultIndex]).toMatchObject({
      type: "emotion:result",
      payload: {
        utteranceId: "segment-1",
        result: emotionResult
      }
    });

    await expect(services.runtime.getSnapshot()).resolves.toMatchObject({
      status: { listening: true },
      utterances: [
        expect.objectContaining({
          id: "segment-1",
          final_text: "final transcript",
          emotion_status: "done",
          emotion: emotionResult
        })
      ]
    });

    await invokeValidated(DesktopCommand.StopListening);
    await expect(services.runtime.getSnapshot()).resolves.toMatchObject({
      status: { listening: false }
    });
    expect(captureSource.getSubscriberCount()).toBe(0);

    workletBridge.forward({
      segmentId: "segment-2",
      samples: Float32Array.from([0.5, 0.2]),
      sampleRate: 16_000,
      isFinal: true
    });
    await Promise.resolve();
    expect(
      runtimeEvents.filter(
        (event) =>
          event.type === "runtime:utterance" &&
          "payload" in event &&
          !!event.payload &&
          typeof event.payload === "object" &&
          "id" in event.payload &&
          event.payload.id === "segment-2"
      )
    ).toHaveLength(0);

    unsubscribe();
  });

  test("switching model while listening returns ASR_MODEL_SWITCH_BLOCKED_WHILE_LISTENING", async () => {
    const services = createInMemoryDesktopIpcServices({ runner: createRunnerStub() });
    registerIpc(services);

    await invokeValidated(DesktopCommand.DownloadAsrModel, { modelId: "whisper-base" });
    await invokeValidated(DesktopCommand.DownloadAsrModel, { modelId: "whisper-small" });
    await invokeValidated(DesktopCommand.StartListening);

    await expect(
      invokeValidated(DesktopCommand.ActivateAsrModel, { modelId: "whisper-small" })
    ).rejects.toMatchObject({
      code: "ASR_MODEL_SWITCH_BLOCKED_WHILE_LISTENING"
    });
  });

  test("switching model during a slow start is blocked", async () => {
    const loadModel = createDeferred<void>();
    const runner: WhisperRunner = {
      loadModel: vi.fn(() => loadModel.promise),
      transcribe: vi.fn(async () => "transcript"),
      reset: vi.fn()
    };
    const services = createInMemoryDesktopIpcServices({ runner });
    registerIpc(services);

    await invokeValidated(DesktopCommand.DownloadAsrModel, { modelId: "whisper-base" });
    await invokeValidated(DesktopCommand.DownloadAsrModel, { modelId: "whisper-small" });
    const startPromise = invokeValidated(DesktopCommand.StartListening);
    await Promise.resolve();

    await expect(
      invokeValidated(DesktopCommand.ActivateAsrModel, { modelId: "whisper-small" })
    ).rejects.toMatchObject({
      code: "ASR_MODEL_SWITCH_BLOCKED_WHILE_LISTENING"
    });

    loadModel.resolve();
    await startPromise;
  });

  test("updating recognition strategy while listening is blocked", async () => {
    const services = createInMemoryDesktopIpcServices({ runner: createRunnerStub() });
    registerIpc(services);

    await invokeValidated(DesktopCommand.DownloadAsrModel, { modelId: "whisper-base" });
    await invokeValidated(DesktopCommand.StartListening);

    await expect(
      invokeValidated(DesktopCommand.UpdateRecognitionStrategy, {
        mode: "fixed",
        fixedLanguage: "en"
      })
    ).rejects.toMatchObject({
      code: "ASR_MODEL_SWITCH_BLOCKED_WHILE_LISTENING"
    });
  });

  test("stop during a slow start does not publish listening true", async () => {
    const loadModel = createDeferred<void>();
    const runner: WhisperRunner = {
      loadModel: vi.fn(() => loadModel.promise),
      transcribe: vi.fn(async () => "transcript"),
      reset: vi.fn()
    };
    const services = createInMemoryDesktopIpcServices({ runner });
    const runtimeEvents: RuntimeEvent[] = [];
    services.runtime.subscribe((event) => {
      runtimeEvents.push(event);
    });
    await services.asr.downloadModel("whisper-base");
    const startPromise = services.session.startListening();
    await Promise.resolve();
    const stopPromise = services.session.stopListening();

    loadModel.resolve();
    await Promise.all([startPromise, stopPromise]);

    expect(
      runtimeEvents.some(
        (event) =>
          event.type === "session:status" && event.payload.listening === true
      )
    ).toBe(false);
    await expect(services.runtime.getSnapshot()).resolves.toMatchObject({
      status: { listening: false }
    });
  });

  test("failed canceled start does not poison the next start attempt", async () => {
    const firstLoadModel = createDeferred<void>();
    const runner: WhisperRunner = {
      loadModel: vi
        .fn()
        .mockImplementationOnce(() => firstLoadModel.promise)
        .mockResolvedValueOnce(undefined),
      transcribe: vi.fn(async () => "transcript"),
      reset: vi.fn()
    };
    const services = createInMemoryDesktopIpcServices({ runner });
    await services.asr.downloadModel("whisper-base");
    const firstStart = services.session.startListening();
    await Promise.resolve();
    const stopPromise = services.session.stopListening();

    firstLoadModel.reject(new Error("load failed"));
    await Promise.allSettled([firstStart, stopPromise]);

    await expect(services.session.startListening()).resolves.toBeUndefined();
    await expect(services.runtime.getSnapshot()).resolves.toMatchObject({
      status: { listening: true }
    });
  });

  test("start-stop-start during a slow load honors the final start intent", async () => {
    const firstLoadModel = createDeferred<void>();
    const runner: WhisperRunner = {
      loadModel: vi
        .fn()
        .mockImplementationOnce(() => firstLoadModel.promise)
        .mockResolvedValueOnce(undefined),
      transcribe: vi.fn(async () => "transcript"),
      reset: vi.fn()
    };
    const services = createInMemoryDesktopIpcServices({ runner });
    await services.asr.downloadModel("whisper-base");
    const firstStart = services.session.startListening();
    await Promise.resolve();
    const stopPromise = services.session.stopListening();
    const secondStart = services.session.startListening();

    firstLoadModel.resolve();
    await Promise.all([firstStart, stopPromise, secondStart]);

    await expect(services.runtime.getSnapshot()).resolves.toMatchObject({
      status: { listening: true }
    });
  });

  test("start-start-stop during a slow load honors the final stop intent", async () => {
    const firstLoadModel = createDeferred<void>();
    const runner: WhisperRunner = {
      loadModel: vi.fn(() => firstLoadModel.promise),
      transcribe: vi.fn(async () => "transcript"),
      reset: vi.fn()
    };
    const services = createInMemoryDesktopIpcServices({ runner });
    await services.asr.downloadModel("whisper-base");
    const firstStart = services.session.startListening();
    await Promise.resolve();
    const secondStart = services.session.startListening();
    const stopPromise = services.session.stopListening();

    firstLoadModel.resolve();
    await Promise.all([firstStart, secondStart, stopPromise]);

    await expect(services.runtime.getSnapshot()).resolves.toMatchObject({
      status: { listening: false }
    });
  });

  test("stopListening drops in-flight final transcripts that finish after stop", async () => {
    const transcribe = createDeferred<string>();
    const runner: WhisperRunner = {
      loadModel: vi.fn(async () => undefined),
      transcribe: vi.fn(() => transcribe.promise),
      reset: vi.fn()
    };
    const services = createInMemoryDesktopIpcServices({ runner });
    const runtimeEvents: RuntimeEvent[] = [];
    services.runtime.subscribe((event) => {
      runtimeEvents.push(event);
    });
    registerIpc(services);

    await invokeValidated(DesktopCommand.DownloadAsrModel, { modelId: "whisper-base" });
    await invokeValidated(DesktopCommand.StartListening);

    const captureListener = getCaptureListener();
    const captureBridge = createCaptureBridge({
      postMessage(channel, message) {
        expect(channel).toBe(CAPTURE_PCM_CHANNEL);
        captureListener({ sender: null }, message);
      }
    });
    const workletBridge = createAudioWorkletBridge({ captureBridge });

    workletBridge.forward({
      segmentId: "segment-1",
      samples: Float32Array.from([0.3, 0.2]),
      sampleRate: 16_000,
      isFinal: true
    });
    await vi.waitFor(() => {
      expect(runner.transcribe).toHaveBeenCalledTimes(1);
    });

    await invokeValidated(DesktopCommand.StopListening);
    transcribe.resolve("late transcript");
    await Promise.resolve();
    await Promise.resolve();

    expect(
      runtimeEvents.some(
        (event) =>
          event.type === "runtime:utterance" &&
          event.payload.id === "segment-1"
      )
    ).toBe(false);
    await expect(services.runtime.getSnapshot()).resolves.toMatchObject({
      status: { listening: false },
      utterances: []
    });
  });

  test("latest-only emotion processing suppresses stale in-flight results", async () => {
    const firstEmotion = createDeferred<EmotionResult>();
    const secondEmotion = createEmotionResult("trust", "latest utterance wins");
    const emotionService = {
      analyzeText: vi.fn((text: string) => {
        if (text === "first transcript") {
          return firstEmotion.promise;
        }
        return Promise.resolve(secondEmotion);
      })
    } satisfies Pick<EmotionService, "analyzeText">;
    const runner: WhisperRunner = {
      loadModel: vi.fn(async () => undefined),
      transcribe: vi
        .fn()
        .mockResolvedValueOnce("first transcript")
        .mockResolvedValueOnce("second transcript"),
      reset: vi.fn()
    };
    const services = createInMemoryDesktopIpcServices({
      runner,
      emotionService,
      osc: {
        sendEmotion: vi.fn(async () => undefined),
        close: vi.fn()
      } satisfies Pick<OscService, "sendEmotion" | "close">
    } as Parameters<typeof createInMemoryDesktopIpcServices>[0]);
    const runtimeEvents: RuntimeEvent[] = [];
    services.runtime.subscribe((event) => {
      runtimeEvents.push(event);
    });
    registerIpc(services);

    await invokeValidated(DesktopCommand.DownloadAsrModel, { modelId: "whisper-base" });
    await invokeValidated(DesktopCommand.StartListening);

    const captureListener = getCaptureListener();
    const captureBridge = createCaptureBridge({
      postMessage(channel, message) {
        expect(channel).toBe(CAPTURE_PCM_CHANNEL);
        captureListener({ sender: null }, message);
      }
    });
    const workletBridge = createAudioWorkletBridge({ captureBridge });

    workletBridge.forward({
      segmentId: "segment-1",
      samples: Float32Array.from([0.1, 0.2]),
      sampleRate: 16_000,
      isFinal: true
    });
    await vi.waitFor(() => {
      expect(emotionService.analyzeText).toHaveBeenCalledWith("first transcript");
    });

    workletBridge.forward({
      segmentId: "segment-2",
      samples: Float32Array.from([0.3, 0.4]),
      sampleRate: 16_000,
      isFinal: true
    });
    await vi.waitFor(() => {
      expect(
        runtimeEvents.some(
          (event) =>
            event.type === "runtime:utterance" &&
            event.payload.id === "segment-2" &&
            event.payload.emotion_status === "queued"
        )
      ).toBe(true);
    });

    firstEmotion.resolve(createEmotionResult("sadness", "stale result should be dropped"));

    await vi.waitFor(() => {
      expect(
        runtimeEvents.some(
          (event) =>
            event.type === "emotion:result" && event.payload.utteranceId === "segment-2"
        )
      ).toBe(true);
    });

    expect(
      runtimeEvents.some(
        (event) => event.type === "emotion:result" && event.payload.utteranceId === "segment-1"
      )
    ).toBe(false);
    await expect(services.runtime.getSnapshot()).resolves.toMatchObject({
      metrics: {
        emotion_stale_total: 1
      },
      utterances: [
        expect.objectContaining({
          id: "segment-1",
          final_text: "first transcript",
          emotion_status: "dropped"
        }),
        expect.objectContaining({
          id: "segment-2",
          final_text: "second transcript",
          emotion_status: "done",
          emotion: secondEmotion
        })
      ]
    });
  });

  test("emotion failures publish runtime errors and increment error metrics", async () => {
    const emotionFailure = Object.assign(new Error("provider unavailable"), {
      code: "PROVIDER_UPSTREAM_UNAVAILABLE"
    });
    const services = createInMemoryDesktopIpcServices({
      runner: createRunnerStub("final transcript"),
      emotionService: {
        analyzeText: vi.fn(async () => {
          throw emotionFailure;
        })
      } satisfies Pick<EmotionService, "analyzeText">,
      osc: {
        sendEmotion: vi.fn(async () => undefined),
        close: vi.fn()
      } satisfies Pick<OscService, "sendEmotion" | "close">
    } as Parameters<typeof createInMemoryDesktopIpcServices>[0]);
    const runtimeEvents: RuntimeEvent[] = [];
    services.runtime.subscribe((event) => {
      runtimeEvents.push(event);
    });
    registerIpc(services);

    await invokeValidated(DesktopCommand.DownloadAsrModel, { modelId: "whisper-base" });
    await invokeValidated(DesktopCommand.StartListening);

    const captureListener = getCaptureListener();
    const captureBridge = createCaptureBridge({
      postMessage(channel, message) {
        expect(channel).toBe(CAPTURE_PCM_CHANNEL);
        captureListener({ sender: null }, message);
      }
    });
    const workletBridge = createAudioWorkletBridge({ captureBridge });

    workletBridge.forward({
      segmentId: "segment-1",
      samples: Float32Array.from([0.2, -0.1]),
      sampleRate: 16_000,
      isFinal: true
    });

    await vi.waitFor(() => {
      expect(runtimeEvents).toContainEqual({
        type: "runtime:error",
        payload: {
          code: "PROVIDER_UPSTREAM_UNAVAILABLE",
          message: "provider unavailable"
        }
      });
    });

    expect(
      runtimeEvents.some((event) => event.type === "emotion:result")
    ).toBe(false);
    await expect(services.runtime.getSnapshot()).resolves.toMatchObject({
      metrics: {
        errors_total: 1
      },
      utterances: [
        expect.objectContaining({
          id: "segment-1",
          final_text: "final transcript",
          emotion_status: "error"
        })
      ]
    });
  });
});
