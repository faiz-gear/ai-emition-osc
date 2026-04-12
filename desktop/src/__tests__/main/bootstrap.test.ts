import { beforeEach, describe, expect, test, vi } from "vitest";

const { destroyCaptureWindowMock, ipcMainHandleMock, onMock, onceMock, stopListeningMock, whenReadyMock } = vi.hoisted(() => ({
  destroyCaptureWindowMock: vi.fn(),
  ipcMainHandleMock: vi.fn(),
  onMock: vi.fn(),
  onceMock: vi.fn(),
  stopListeningMock: vi.fn(async () => undefined),
  whenReadyMock: vi.fn(async () => undefined)
}));

const browserWindowCtor = vi.fn(() => ({
  on: vi.fn(),
  isDestroyed: vi.fn(() => false),
  loadURL: vi.fn(),
  loadFile: vi.fn()
}));
const browserWindowGetAllWindowsMock = vi.fn(() => []);
const browserWindowMock = Object.assign(browserWindowCtor, {
  getAllWindows: browserWindowGetAllWindowsMock
});

vi.mock("electron", () => ({
  app: {
    whenReady: whenReadyMock,
    on: onMock,
    once: onceMock
  },
  ipcMain: {
    handle: ipcMainHandleMock
  },
  BrowserWindow: browserWindowMock
}));

vi.mock("../../main/windows/capture-window-runtime", () => ({
  destroyCaptureWindow: destroyCaptureWindowMock,
  resolveCaptureEntry(isDev: boolean) {
    return isDev
      ? `${process.env.ELECTRON_RENDERER_URL ?? "http://localhost:5173"}/capture.html`
      : "/tmp/desktop/out/renderer/capture.html";
  }
}));

vi.mock("../../main/runtime/create-desktop-ipc-services", () => ({
  getDefaultDesktopIpcServices: vi.fn(async () => ({
    session: {
      stopListening: stopListeningMock
    }
  }))
}));

describe("desktop bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    browserWindowGetAllWindowsMock.mockReturnValue([]);
  });

  function createFakeWindow() {
    let destroyed = false;
    const listeners = new Map<string, () => void>();

    return {
      on: vi.fn((eventName: string, listener: () => void) => {
        listeners.set(eventName, listener);
      }),
      isDestroyed: vi.fn(() => destroyed),
      loadURL: vi.fn(),
      loadFile: vi.fn(),
      markDestroyed() {
        destroyed = true;
      },
      emitClosed() {
        destroyed = true;
        listeners.get("closed")?.();
      }
    };
  }

  test("electron main entrypoint invokes bootstrap on module load", async () => {
    vi.resetModules();
    const bootstrapMainMock = vi.fn(async () => undefined);
    vi.doMock("../../main/index", () => ({
      bootstrapMain: bootstrapMainMock
    }));

    await import("../../main/main");

    expect(bootstrapMainMock).toHaveBeenCalledTimes(1);
    vi.doUnmock("../../main/index");
  });

  test("main process bootstrap creates only the visible main window", async () => {
    vi.resetModules();
    vi.doUnmock("../../main/index");
    const mainWindow = createFakeWindow();
    const createMainWindowMock = vi.fn(() => mainWindow);
    vi.doMock("../../main/windows/create-main-window", () => ({
      createMainWindow: createMainWindowMock
    }));

    const { bootstrapMain } = await import("../../main/index");
    await bootstrapMain();

    expect(whenReadyMock).toHaveBeenCalledTimes(1);
    expect(ipcMainHandleMock).toHaveBeenCalled();
    expect(createMainWindowMock).toHaveBeenCalledTimes(1);
    expect(onMock).toHaveBeenCalledWith("activate", expect.any(Function));
  });

  test("activate does not recreate the main window while it is alive", async () => {
    vi.resetModules();
    vi.doUnmock("../../main/index");
    const mainWindow = createFakeWindow();
    const createMainWindowMock = vi.fn(() => mainWindow);
    vi.doMock("../../main/windows/create-main-window", () => ({
      createMainWindow: createMainWindowMock
    }));

    const { bootstrapMain } = await import("../../main/index");
    await bootstrapMain();

    const activateHandler = onMock.mock.calls.find(([eventName]) => eventName === "activate")?.[1];
    expect(activateHandler).toBeTypeOf("function");
    activateHandler?.();

    expect(createMainWindowMock).toHaveBeenCalledTimes(1);
  });

  test("activate recreates the main window after it closes", async () => {
    vi.resetModules();
    vi.doUnmock("../../main/index");
    const mainWindow = createFakeWindow();
    const createMainWindowMock = vi.fn(() => mainWindow);
    vi.doMock("../../main/windows/create-main-window", () => ({
      createMainWindow: createMainWindowMock
    }));

    const { bootstrapMain } = await import("../../main/index");
    await bootstrapMain();

    const activateHandler = onMock.mock.calls.find(([eventName]) => eventName === "activate")?.[1];
    expect(activateHandler).toBeTypeOf("function");

    mainWindow.emitClosed();
    activateHandler?.();

    await vi.waitFor(() => {
      expect(createMainWindowMock).toHaveBeenCalledTimes(2);
    });
  });

  test("closing the main window tears down any hidden capture window", async () => {
    vi.resetModules();
    vi.doUnmock("../../main/index");
    const mainWindow = createFakeWindow();
    const createMainWindowMock = vi.fn(() => mainWindow);
    vi.doMock("../../main/windows/create-main-window", () => ({
      createMainWindow: createMainWindowMock
    }));

    const { bootstrapMain } = await import("../../main/index");
    await bootstrapMain();

    mainWindow.emitClosed();

    await vi.waitFor(() => {
      expect(stopListeningMock).toHaveBeenCalledTimes(1);
      expect(destroyCaptureWindowMock).toHaveBeenCalledTimes(1);
    });
  });

  test("BrowserWindow preload path is configured for unsandboxed preload execution", async () => {
    vi.resetModules();
    vi.doUnmock("../../main/index");
    vi.doUnmock("../../main/windows/create-main-window");
    vi.doUnmock("../../main/windows/create-capture-window");

    const { createMainWindow } = await import("../../main/windows/create-main-window");
    const { createCaptureWindow } = await import("../../main/windows/create-capture-window");
    createMainWindow("http://localhost:3000", true);
    createCaptureWindow({
      captureEntry: "http://localhost:5173/capture.html",
      isDev: true
    });

    expect(browserWindowCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        webPreferences: expect.objectContaining({
          contextIsolation: true,
          sandbox: false,
          preload: expect.stringMatching(/preload\/index\.mjs$/)
        })
      })
    );
    expect(browserWindowCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        webPreferences: expect.objectContaining({
          contextIsolation: true,
          sandbox: false,
          preload: expect.stringMatching(/preload\/index\.mjs$/)
        })
      })
    );
  });

  test("production renderer entry targets exported client html", async () => {
    vi.resetModules();
    vi.doUnmock("../../main/index");
    vi.doUnmock("../../main/windows/create-main-window");

    const { resolveRendererEntry } = await import("../../main/index");
    expect(resolveRendererEntry(false)).toMatch(/client-dist\/index\.html$/);
  });

  test("capture entry resolves to the renderer bundle output html", async () => {
    vi.resetModules();
    vi.doUnmock("../../main/index");
    process.env.ELECTRON_RENDERER_URL = "http://localhost:5175";

    const { resolveCaptureEntry } = await import("../../main/index");
    expect(resolveCaptureEntry(false)).toMatch(/desktop\/out\/renderer\/capture\.html$/);
    expect(resolveCaptureEntry(true)).toBe("http://localhost:5175/capture.html");
  });
});
