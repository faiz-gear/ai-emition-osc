import { beforeEach, describe, expect, test, vi } from "vitest";

const whenReadyMock = vi.fn(async () => undefined);
const onMock = vi.fn();
const ipcMainHandleMock = vi.fn();

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
    on: onMock
  },
  ipcMain: {
    handle: ipcMainHandleMock
  },
  BrowserWindow: browserWindowMock
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

  test("main process bootstrap creates both main and hidden capture windows", async () => {
    vi.resetModules();
    vi.doUnmock("../../main/index");
    const mainWindow = createFakeWindow();
    const captureWindow = createFakeWindow();
    const createMainWindowMock = vi.fn(() => mainWindow);
    const createCaptureWindowMock = vi.fn(() => captureWindow);
    vi.doMock("../../main/windows/create-main-window", () => ({
      createMainWindow: createMainWindowMock
    }));
    vi.doMock("../../main/windows/create-capture-window", () => ({
      createCaptureWindow: createCaptureWindowMock
    }));

    const { bootstrapMain } = await import("../../main/index");
    await bootstrapMain();

    expect(whenReadyMock).toHaveBeenCalledTimes(1);
    expect(ipcMainHandleMock).toHaveBeenCalled();
    expect(createMainWindowMock).toHaveBeenCalledTimes(1);
    expect(createCaptureWindowMock).toHaveBeenCalledTimes(1);
    expect(onMock).toHaveBeenCalledWith("activate", expect.any(Function));
  });

  test("activate does not recreate windows while current windows are alive", async () => {
    vi.resetModules();
    vi.doUnmock("../../main/index");
    const mainWindow = createFakeWindow();
    const captureWindow = createFakeWindow();
    const createMainWindowMock = vi.fn(() => mainWindow);
    const createCaptureWindowMock = vi.fn(() => captureWindow);
    vi.doMock("../../main/windows/create-main-window", () => ({
      createMainWindow: createMainWindowMock
    }));
    vi.doMock("../../main/windows/create-capture-window", () => ({
      createCaptureWindow: createCaptureWindowMock
    }));

    const { bootstrapMain } = await import("../../main/index");
    await bootstrapMain();

    const activateHandler = onMock.mock.calls.find(([eventName]) => eventName === "activate")?.[1];
    expect(activateHandler).toBeTypeOf("function");
    activateHandler?.();

    expect(createMainWindowMock).toHaveBeenCalledTimes(1);
    expect(createCaptureWindowMock).toHaveBeenCalledTimes(1);
  });

  test("activate recreates destroyed windows", async () => {
    vi.resetModules();
    vi.doUnmock("../../main/index");
    const mainWindow = createFakeWindow();
    const captureWindow = createFakeWindow();
    const createMainWindowMock = vi.fn(() => mainWindow);
    const createCaptureWindowMock = vi.fn(() => captureWindow);
    vi.doMock("../../main/windows/create-main-window", () => ({
      createMainWindow: createMainWindowMock
    }));
    vi.doMock("../../main/windows/create-capture-window", () => ({
      createCaptureWindow: createCaptureWindowMock
    }));

    const { bootstrapMain } = await import("../../main/index");
    await bootstrapMain();

    const activateHandler = onMock.mock.calls.find(([eventName]) => eventName === "activate")?.[1];
    expect(activateHandler).toBeTypeOf("function");

    mainWindow.markDestroyed();
    captureWindow.markDestroyed();
    activateHandler?.();

    expect(createMainWindowMock).toHaveBeenCalledTimes(2);
    expect(createCaptureWindowMock).toHaveBeenCalledTimes(2);
  });

  test("BrowserWindow preload path is configured", async () => {
    vi.resetModules();
    vi.doUnmock("../../main/index");
    vi.doUnmock("../../main/windows/create-main-window");

    const { createMainWindow } = await import("../../main/windows/create-main-window");
    createMainWindow("http://localhost:3000", true);

    expect(browserWindowCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        webPreferences: expect.objectContaining({
          contextIsolation: true,
          preload: expect.stringMatching(/preload\/index\.(js|ts)$/)
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

    const { resolveCaptureEntry } = await import("../../main/index");
    expect(resolveCaptureEntry(false)).toMatch(/desktop\/out\/renderer\/capture\.html$/);
    expect(resolveCaptureEntry(true)).toBe("http://localhost:5173/capture.html");
  });
});
