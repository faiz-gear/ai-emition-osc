import { beforeEach, describe, expect, test, vi } from "vitest";
import { CAPTURE_STATUS_CHANNEL } from "../../../runtime/asr/capture-ipc";

const { createCaptureWindowMock, ipcMainOffMock, ipcMainOnMock } = vi.hoisted(() => ({
  createCaptureWindowMock: vi.fn(),
  ipcMainOffMock: vi.fn(),
  ipcMainOnMock: vi.fn()
}));

vi.mock("electron", () => ({
  ipcMain: {
    on: ipcMainOnMock,
    off: ipcMainOffMock
  }
}));

vi.mock("../../../main/windows/create-capture-window", () => ({
  createCaptureWindow: createCaptureWindowMock
}));

function createFakeCaptureWindow() {
  let destroyed = false;
  const windowListeners = new Map<string, Array<() => void>>();
  const webContentsListeners = new Map<string, Array<(...args: unknown[]) => void>>();
  const webContents = {
    on: vi.fn((eventName: string, listener: (...args: unknown[]) => void) => {
      const listeners = webContentsListeners.get(eventName) ?? [];
      listeners.push(listener);
      webContentsListeners.set(eventName, listeners);
    }),
    off: vi.fn((eventName: string, listener: (...args: unknown[]) => void) => {
      webContentsListeners.set(
        eventName,
        (webContentsListeners.get(eventName) ?? []).filter((entry) => entry !== listener)
      );
    })
  };
  const window = {
    webContents,
    on: vi.fn((eventName: string, listener: () => void) => {
      const listeners = windowListeners.get(eventName) ?? [];
      listeners.push(listener);
      windowListeners.set(eventName, listeners);
    }),
    off: vi.fn((eventName: string, listener: () => void) => {
      windowListeners.set(
        eventName,
        (windowListeners.get(eventName) ?? []).filter((entry) => entry !== listener)
      );
    }),
    isDestroyed: vi.fn(() => destroyed),
    close: vi.fn(() => {
      destroyed = true;
      for (const listener of windowListeners.get("closed") ?? []) {
        listener();
      }
    }),
    destroy: vi.fn(() => {
      destroyed = true;
      for (const listener of windowListeners.get("closed") ?? []) {
        listener();
      }
    })
  };

  return {
    window,
    emitStatus(payload: unknown) {
      const registration = ipcMainOnMock.mock.calls.find(([channel]) => channel === CAPTURE_STATUS_CHANNEL);
      expect(registration, `Missing capture status listener for ${CAPTURE_STATUS_CHANNEL}`).toBeTruthy();
      const [, listener] = registration as [string, (event: { sender: unknown }, value: unknown) => void];
      listener({ sender: webContents }, payload);
    },
    emitLoadFailure(description = "capture failed to load") {
      for (const listener of webContentsListeners.get("did-fail-load") ?? []) {
        listener({}, -1, description);
      }
    }
  };
}

describe("captureWindowRuntime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("ensureCaptureWindow waits for a ready status before resolving", async () => {
    vi.resetModules();
    const harness = createFakeCaptureWindow();
    createCaptureWindowMock.mockReturnValueOnce(harness.window);

    const { ensureCaptureWindow } = await import("../../../main/windows/capture-window-runtime");
    let settled = false;
    const readyPromise = ensureCaptureWindow(true).then((window) => {
      settled = true;
      return window;
    });

    await Promise.resolve();
    expect(settled).toBe(false);

    harness.emitStatus({ type: "ready" });

    await expect(readyPromise).resolves.toBe(harness.window);
  });

  test("concurrent ensureCaptureWindow calls share the same in-flight readiness promise", async () => {
    vi.resetModules();
    const harness = createFakeCaptureWindow();
    createCaptureWindowMock.mockReturnValueOnce(harness.window);

    const { ensureCaptureWindow } = await import("../../../main/windows/capture-window-runtime");
    let secondSettled = false;
    const firstPromise = ensureCaptureWindow(true);
    const secondPromise = ensureCaptureWindow(true).then((window) => {
      secondSettled = true;
      return window;
    });

    await Promise.resolve();
    expect(createCaptureWindowMock).toHaveBeenCalledTimes(1);
    expect(secondSettled).toBe(false);

    harness.emitStatus({ type: "ready" });

    await expect(firstPromise).resolves.toBe(harness.window);
    await expect(secondPromise).resolves.toBe(harness.window);
  });

  test("ensureCaptureWindow rejects when capture startup reports an error", async () => {
    vi.resetModules();
    const harness = createFakeCaptureWindow();
    createCaptureWindowMock.mockReturnValueOnce(harness.window);

    const { ensureCaptureWindow } = await import("../../../main/windows/capture-window-runtime");
    const readyPromise = ensureCaptureWindow(true);

    harness.emitStatus({
      type: "error",
      code: "ASR_RECOGNITION_FAILED",
      message: "microphone access denied"
    });

    await expect(readyPromise).rejects.toMatchObject({
      code: "ASR_RECOGNITION_FAILED",
      message: "microphone access denied"
    });
    expect(harness.window.close).toHaveBeenCalledTimes(1);
  });

  test("ensureCaptureWindow rejects when the hidden page fails to load", async () => {
    vi.resetModules();
    const harness = createFakeCaptureWindow();
    createCaptureWindowMock.mockReturnValueOnce(harness.window);

    const { ensureCaptureWindow } = await import("../../../main/windows/capture-window-runtime");
    const readyPromise = ensureCaptureWindow(true);

    harness.emitLoadFailure("renderer load failed");

    await expect(readyPromise).rejects.toMatchObject({
      code: "ASR_RECOGNITION_FAILED",
      message: "renderer load failed"
    });
  });
});
