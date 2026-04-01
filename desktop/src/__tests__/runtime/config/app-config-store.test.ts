import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { beforeEach, describe, expect, expectTypeOf, test } from "vitest";
import type { RecognitionStrategy } from "@ai-emotion/contracts";
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

    await expect(store.getRecognitionStrategy()).resolves.toEqual({ mode: "auto" });

    await rm(sandboxRoot, { recursive: true, force: true });
  });

  test("strategy updates are explicit store operations and listening guard is service-owned", async () => {
    const fakeApp: TestElectronApp = {
      getPath(name) {
        return name === "appData" ? appDataPath : userDataPath;
      },
      getAppPath() {
        return "/Applications/AI Emotion.app/Contents/Resources/app.asar";
      }
    };
    const store = createAppConfigStore({ app: fakeApp });

    expectTypeOf(store.updateRecognitionStrategy).parameters.toEqualTypeOf<[RecognitionStrategy]>();

    const snapshot = await store.read();
    snapshot.asr.languageMode = "fixed";
    snapshot.asr.fixedLanguage = "en";

    await expect(store.getRecognitionStrategy()).resolves.toEqual({ mode: "auto" });
    await expect(
      store.updateRecognitionStrategy({ mode: "fixed", fixedLanguage: "en" })
    ).resolves.toEqual({ mode: "fixed", fixedLanguage: "en" });

    await rm(sandboxRoot, { recursive: true, force: true });
  });
});
