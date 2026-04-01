import { describe, expect, test, vi } from "vitest";

const whenReadyMock = vi.fn(async () => undefined);
const onMock = vi.fn();

const browserWindowCtor = vi.fn(() => ({
  loadURL: vi.fn(),
  loadFile: vi.fn()
}));

vi.mock("electron", () => ({
  app: {
    whenReady: whenReadyMock,
    on: onMock
  },
  BrowserWindow: browserWindowCtor
}));

describe("desktop bootstrap", () => {
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
    expect(createMainWindowMock).toHaveBeenCalledTimes(1);
    expect(onMock).toHaveBeenCalledWith("activate", expect.any(Function));
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
