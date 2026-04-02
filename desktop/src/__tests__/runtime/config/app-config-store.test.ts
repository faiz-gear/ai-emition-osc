import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { beforeEach, describe, expect, test } from "vitest";
import { createAppConfigStore } from "../../../runtime/config/app-config-store";

type TestElectronApp = {
  getPath(name: "appData" | "userData"): string;
  getAppPath(): string;
};

describe("app config store", () => {
  let sandboxRoot = "";
  let appDataPath = "";
  let userDataPath = "";

  beforeEach(async () => {
    sandboxRoot = await mkdtemp(join(tmpdir(), "app-config-store-test-"));
    appDataPath = join(sandboxRoot, "app-data");
    userDataPath = join(sandboxRoot, "user-data");
  });

  test("app data paths resolve outside packaged app", async () => {
    const fakeApp: TestElectronApp = {
      getPath(name) {
        return name === "appData" ? appDataPath : userDataPath;
      },
      getAppPath() {
        return "/Applications/AI Emotion.app/Contents/Resources/app.asar";
      }
    };
    const store = createAppConfigStore({ app: fakeApp });
    const paths = store.getPaths();

    expect(paths.appDataPath).toBe(appDataPath);
    expect(paths.userDataPath).toBe(userDataPath);
    expect(paths.configFilePath).toContain(userDataPath);
    expect(paths.providerDbPath).toContain(userDataPath);
    expect(paths.asrModelRootPath).toContain(userDataPath);
    expect(paths.configFilePath).not.toContain("app.asar");
    expect(paths.providerDbPath).not.toContain("app.asar");
    expect(paths.asrModelRootPath).not.toContain("app.asar");

    await rm(sandboxRoot, { recursive: true, force: true });
  });

  test("first run defaults contain no installed ASR models", async () => {
    const fakeApp: TestElectronApp = {
      getPath(name) {
        return name === "appData" ? appDataPath : userDataPath;
      },
      getAppPath() {
        return "/Applications/AI Emotion.app/Contents/Resources/app.asar";
      }
    };
    const store = createAppConfigStore({ app: fakeApp });

    await expect(store.read()).resolves.toMatchObject({
      asr: {
        installedModels: []
      }
    });

    await rm(sandboxRoot, { recursive: true, force: true });
  });

  test("recognition strategy defaults to auto", async () => {
    const fakeApp: TestElectronApp = {
      getPath(name) {
        return name === "appData" ? appDataPath : userDataPath;
      },
      getAppPath() {
        return "/Applications/AI Emotion.app/Contents/Resources/app.asar";
      }
    };
    const store = createAppConfigStore({ app: fakeApp });

    await expect(store.read()).resolves.toMatchObject({
      asr: {
        languageMode: "auto",
        fixedLanguage: null
      }
    });

    await rm(sandboxRoot, { recursive: true, force: true });
  });

  test("switching strategy while listening is rejected by service guard, not store mutation rules", async () => {
    const fakeApp: TestElectronApp = {
      getPath(name) {
        return name === "appData" ? appDataPath : userDataPath;
      },
      getAppPath() {
        return "/Applications/AI Emotion.app/Contents/Resources/app.asar";
      }
    };
    const store = createAppConfigStore({ app: fakeApp });

    const strategyService = createGuardedStrategyService(store);
    strategyService.listening = true;

    await expect(strategyService.setFixedLanguage("en")).rejects.toThrow(/listening/i);

    await expect(store.read()).resolves.toMatchObject({
      asr: {
        languageMode: "auto",
        fixedLanguage: null
      }
    });

    strategyService.listening = false;
    await strategyService.setFixedLanguage("en");

    await expect(store.read()).resolves.toMatchObject({
      asr: {
        languageMode: "fixed",
        fixedLanguage: "en"
      }
    });

    await rm(sandboxRoot, { recursive: true, force: true });
  });
});

function createGuardedStrategyService(store: ReturnType<typeof createAppConfigStore>) {
  return {
    listening: false,
    async setFixedLanguage(language: "zh" | "en") {
      if (this.listening) {
        throw new Error("cannot switch strategy while listening");
      }

      await store.updateAsr((current) => ({
        ...current,
        languageMode: "fixed",
        fixedLanguage: language
      }));
    }
  };
}
