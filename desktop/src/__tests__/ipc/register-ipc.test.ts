import { beforeEach, describe, expect, expectTypeOf, test, vi } from "vitest";
import {
  DesktopCommand,
  DesktopEventChannel,
  type DesktopApi,
  type RuntimeEvent
} from "@ai-emotion/contracts";
import { createDesktopApi } from "../../preload/desktop-api";
import { createInMemoryDesktopIpcServices } from "../../main/ipc/in-memory-desktop-ipc-services";
import { registerIpc } from "../../main/ipc/register-ipc";
import { CAPTURE_PCM_CHANNEL } from "../../runtime/asr/capture-ipc";

const {
  browserWindowGetAllWindowsMock,
  destroyCaptureWindowMock,
  ensureCaptureWindowMock,
  handleMock,
  ipcMainOnMock,
  ipcRendererInvokeMock,
  ipcRendererOnMock,
  ipcRendererOffMock
} = vi.hoisted(() => ({
  browserWindowGetAllWindowsMock: vi.fn(() => []),
  destroyCaptureWindowMock: vi.fn(),
  ensureCaptureWindowMock: vi.fn(),
  handleMock: vi.fn(),
  ipcMainOnMock: vi.fn(),
  ipcRendererInvokeMock: vi.fn(),
  ipcRendererOnMock: vi.fn(),
  ipcRendererOffMock: vi.fn()
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: handleMock,
    on: ipcMainOnMock
  },
  BrowserWindow: {
    getAllWindows: browserWindowGetAllWindowsMock
  },
  ipcRenderer: {
    invoke: ipcRendererInvokeMock,
    on: ipcRendererOnMock,
    off: ipcRendererOffMock
  }
}));

vi.mock("../../main/windows/capture-window-runtime", () => ({
  destroyCaptureWindow: destroyCaptureWindowMock,
  ensureCaptureWindow: ensureCaptureWindowMock
}));

const expectedCommandNames = [
  "session:start-listening",
  "session:stop-listening",
  "runtime:get-snapshot",
  "asr:list-model-catalog",
  "asr:list-installed-models",
  "asr:download-model",
  "asr:activate-model",
  "asr:delete-model",
  "asr:get-recognition-strategy",
  "asr:update-recognition-strategy",
  "providers:list",
  "providers:create",
  "providers:update",
  "providers:delete",
  "providers:test",
  "providers:activate"
] as const;

function createServices() {
  return {
    session: {
      startListening: vi.fn(async () => undefined),
      stopListening: vi.fn(async () => undefined),
      handleCapturePcmFrame: vi.fn(async () => undefined)
    },
    runtime: {
      getSnapshot: vi.fn(async () => ({
        status: { listening: false },
        metrics: {
          uptime_seconds: 0,
          ws_clients: 0,
          utterances_total: 0,
          emotion_total: 0,
          errors_total: 0
        },
        utterances: []
      })),
      subscribe: vi.fn((_listener: (event: RuntimeEvent) => void) => () => undefined),
      publishError: vi.fn()
    },
    asr: {
      listCatalog: vi.fn(async () => []),
      listInstalled: vi.fn(async () => []),
      downloadModel: vi.fn(async (_modelId: string) => undefined),
      activateModel: vi.fn(async (_modelId: string) => undefined),
      deleteModel: vi.fn(async (_modelId: string) => undefined),
      getRecognitionStrategy: vi.fn(async () => ({ mode: "auto" as const })),
      updateRecognitionStrategy: vi.fn(
        async (input: { mode: "auto" } | { mode: "fixed"; fixedLanguage: "zh" | "en" }) => input
      )
    },
    providers: {
      list: vi.fn(async () => ({ providers: [] })),
      create: vi.fn(async (input: unknown) => ({ id: "provider-1", ...(input as object) })),
      update: vi.fn(async (input: unknown) => ({ id: "provider-1", ...(input as object) })),
      delete: vi.fn(async (_providerId: string) => undefined),
      test: vi.fn(async (_providerId: string) => ({ ok: true, latency_ms: 12 })),
      activate: vi.fn(async (_providerId: string) => undefined)
    }
  };
}

async function invokeValidated(command: string, payload?: unknown) {
  const registration = handleMock.mock.calls.find(([channel]) => channel === command);
  expect(registration, `Missing registration for ${command}`).toBeTruthy();
  const [, handler] = registration as [string, (_event: unknown, input?: unknown) => Promise<unknown>];
  return handler({} as unknown, payload);
}

function getCaptureListener() {
  const registration = ipcMainOnMock.mock.calls.find(([channel]) => channel === CAPTURE_PCM_CHANNEL);
  expect(registration, `Missing capture listener for ${CAPTURE_PCM_CHANNEL}`).toBeTruthy();
  const [, listener] = registration as [string, (_event: unknown, payload: unknown) => void];
  return listener;
}

describe("registerIpc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    browserWindowGetAllWindowsMock.mockReturnValue([]);
  });

  function createRunnerStub() {
    return {
      loadModel: vi.fn(async () => undefined),
      transcribe: vi.fn(async () => ""),
      reset: vi.fn()
    };
  }

  test("registers every renderer command exactly once", async () => {
    expect(Object.values(DesktopCommand).sort()).toEqual([...expectedCommandNames].sort());

    registerIpc(createServices());

    const registeredChannels = handleMock.mock.calls.map(([channel]) => channel);
    expect(registeredChannels.sort()).toEqual([...Object.values(DesktopCommand)].sort());

    for (const commandName of Object.values(DesktopCommand)) {
      expect(registeredChannels.filter((channel) => channel === commandName)).toHaveLength(1);
    }
  });

  test("update recognition strategy rejects unsupported fixed language", async () => {
    const services = createServices();
    registerIpc(services);

    await expect(
      invokeValidated("asr:update-recognition-strategy", {
        mode: "fixed",
        fixedLanguage: "ja"
      })
    ).rejects.toThrow(/invalid/i);

    expect(services.asr.updateRecognitionStrategy).not.toHaveBeenCalled();
  });

  test("start and stop listening manage the hidden capture window lifecycle", async () => {
    const services = createServices();
    registerIpc(services);

    await invokeValidated(DesktopCommand.StartListening);
    await invokeValidated(DesktopCommand.StopListening);

    expect(services.session.startListening).toHaveBeenCalledTimes(1);
    expect(ensureCaptureWindowMock).toHaveBeenCalledTimes(1);
    expect(services.session.stopListening).toHaveBeenCalledTimes(1);
    expect(destroyCaptureWindowMock).toHaveBeenCalledTimes(1);
  });

  test("capture worker failures publish runtime errors instead of being dropped", async () => {
    const services = createServices();
    services.session.handleCapturePcmFrame.mockRejectedValueOnce(
      Object.assign(new Error("capture failed"), {
        code: "ASR_RECOGNITION_FAILED"
      })
    );
    registerIpc(services);

    const captureListener = getCaptureListener();
    captureListener(
      {} as unknown,
      {
        segmentId: "segment-1",
        sampleRate: 16_000,
        isFinal: true,
        samples: Float32Array.from([0.1, -0.1])
      }
    );

    await vi.waitFor(() => {
      expect(services.runtime.publishError).toHaveBeenCalledWith(
        "ASR_RECOGNITION_FAILED",
        "capture failed"
      );
    });
  });

  test("session subscription returns an unsubscribe function", () => {
    const listener = vi.fn();
    const api = createDesktopApi();

    const unsubscribe = api.session.subscribe(listener);

    expect(typeof unsubscribe).toBe("function");
    expect(ipcRendererOnMock).toHaveBeenCalledWith(DesktopEventChannel.RuntimeEvent, expect.any(Function));

    const [, wrappedListener] = ipcRendererOnMock.mock.calls[0] as [
      string,
      (_event: unknown, runtimeEvent: RuntimeEvent) => void
    ];
    const runtimeEvent: RuntimeEvent = {
      type: "runtime:status",
      payload: { listening: true }
    };

    wrappedListener({} as unknown, runtimeEvent);
    expect(listener).toHaveBeenCalledWith(runtimeEvent);

    unsubscribe();
    expect(ipcRendererOffMock).toHaveBeenCalledWith(
      DesktopEventChannel.RuntimeEvent,
      wrappedListener
    );
  });

  test("in-memory ipc services keep placeholder state isolated per instance", async () => {
    const firstServices = createInMemoryDesktopIpcServices({
      runner: createRunnerStub()
    });
    const secondServices = createInMemoryDesktopIpcServices({
      runner: createRunnerStub()
    });

    await firstServices.asr.downloadModel("whisper-base");
    await firstServices.session.startListening();

    await expect(firstServices.runtime.getSnapshot()).resolves.toMatchObject({
      status: { listening: true }
    });
    await expect(secondServices.runtime.getSnapshot()).resolves.toMatchObject({
      status: { listening: false }
    });
  });

  test("window desktopApi ambient type matches the shared contract surface", () => {
    expectTypeOf<Window["desktopApi"]>().toEqualTypeOf<DesktopApi>();
  });
});
