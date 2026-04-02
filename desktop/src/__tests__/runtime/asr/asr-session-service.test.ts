import { beforeEach, describe, expect, test, vi } from "vitest";
import { DesktopCommand, type RuntimeEvent } from "@ai-emotion/contracts";
import { createAudioWorkletBridge } from "../../../capture/audio-worklet-bridge";
import { registerIpc } from "../../../main/ipc/register-ipc";
import { createInMemoryDesktopIpcServices } from "../../../main/ipc/in-memory-desktop-ipc-services";
import { createCaptureBridge } from "../../../preload/desktop-api";
import type { WhisperRunner } from "../../../runtime/asr/asr-worker";
import { CAPTURE_PCM_CHANNEL } from "../../../runtime/asr/capture-ipc";

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

describe("task-8 capture-to-asr flow", () => {
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

  test("pcm frames from capture bridge produce one finalized transcript event when a segment closes", async () => {
    const services = createInMemoryDesktopIpcServices({ runner: createRunnerStub("final transcript") });
    const runtimeEvents: RuntimeEvent[] = [];
    const unsubscribe = services.runtime.subscribe((event) => {
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
      const utteranceEvents = runtimeEvents.filter((event) => event.type === "runtime:utterance");
      expect(utteranceEvents).toHaveLength(1);
    });

    const [utteranceEvent] = runtimeEvents.filter((event) => event.type === "runtime:utterance");
    expect(utteranceEvent).toMatchObject({
      type: "runtime:utterance",
      payload: {
        final_text: "final transcript",
        emotion_status: "queued"
      }
    });

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
});
