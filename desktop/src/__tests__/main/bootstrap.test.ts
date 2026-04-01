import { beforeEach, describe, expect, test, vi } from "vitest";

const whenReadyMock = vi.fn(async () => undefined);
const onMock = vi.fn();
const ipcMainHandleMock = vi.fn();

const browserWindowCtor = vi.fn(() => ({
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

  test("main process bootstrap delegates BrowserWindow creation to createMainWindow", async () => {
    vi.resetModules();
    vi.doUnmock("../../main/index");
    const createMainWindowMock = vi.fn(() => ({
      loadURL: vi.fn(),
      loadFile: vi.fn()
    }));
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

  test("activate creates window when no windows are open", async () => {
    vi.resetModules();
    vi.doUnmock("../../main/index");
    const createMainWindowMock = vi.fn(() => ({
      loadURL: vi.fn(),
      loadFile: vi.fn()
    }));
    vi.doMock("../../main/windows/create-main-window", () => ({
      createMainWindow: createMainWindowMock
    }));

    const { bootstrapMain } = await import("../../main/index");
    await bootstrapMain();

    const activateHandler = onMock.mock.calls.find(([eventName]) => eventName === "activate")?.[1];
    expect(activateHandler).toBeTypeOf("function");

    browserWindowGetAllWindowsMock.mockReturnValue([]);
    activateHandler?.();

    expect(createMainWindowMock).toHaveBeenCalledTimes(2);
  });

  test("activate does not create window when one already exists", async () => {
    vi.resetModules();
    vi.doUnmock("../../main/index");
    const createMainWindowMock = vi.fn(() => ({
      loadURL: vi.fn(),
      loadFile: vi.fn()
    }));
    vi.doMock("../../main/windows/create-main-window", () => ({
      createMainWindow: createMainWindowMock
    }));

    const { bootstrapMain } = await import("../../main/index");
    await bootstrapMain();

    const activateHandler = onMock.mock.calls.find(([eventName]) => eventName === "activate")?.[1];
    expect(activateHandler).toBeTypeOf("function");

    browserWindowGetAllWindowsMock.mockReturnValue([{}] as never[]);
    activateHandler?.();

    expect(createMainWindowMock).toHaveBeenCalledTimes(1);
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
});
