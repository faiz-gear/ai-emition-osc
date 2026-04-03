import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
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

  test("concurrent updateAsr and updateOsc calls are serialized and do not clobber writes", async () => {
    const fakeApp: TestElectronApp = {
      getPath(name) {
        return name === "appData" ? appDataPath : userDataPath;
      },
      getAppPath() {
        return "/Applications/AI Emotion.app/Contents/Resources/app.asar";
      }
    };
    const store = createAppConfigStore({ app: fakeApp });

    await Promise.all([
      store.updateAsr((current) => ({
        ...current,
        languageMode: "fixed",
        fixedLanguage: "zh"
      })),
      store.updateOsc((current) => ({
        ...current,
        host: "127.0.0.2"
      }))
    ]);

    await expect(store.read()).resolves.toMatchObject({
      asr: {
        languageMode: "fixed",
        fixedLanguage: "zh"
      },
      osc: {
        host: "127.0.0.2",
        port: 9000
      }
    });

    await rm(sandboxRoot, { recursive: true, force: true });
  });

  test("invalid on-disk config is normalized and repaired on persistence", async () => {
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
    await mkdir(dirname(paths.configFilePath), { recursive: true });

    await writeFile(
      paths.configFilePath,
      JSON.stringify({
        asr: {
          languageMode: "fixed",
          fixedLanguage: null,
          installedModels: []
        },
        osc: {
          host: "127.0.0.1",
          port: 9000
        }
      }),
      "utf8"
    );

    await expect(store.read()).resolves.toMatchObject({
      asr: {
        languageMode: "auto",
        fixedLanguage: null
      }
    });

    await store.updateOsc((current) => ({ ...current, port: 9100 }));

    const repairedRaw = JSON.parse(await readFile(paths.configFilePath, "utf8")) as {
      asr: { languageMode: string; fixedLanguage: string | null };
      osc: { host: string; port: number };
    };
    expect(repairedRaw.asr).toMatchObject({
      languageMode: "auto",
      fixedLanguage: null
    });
    expect(repairedRaw.osc).toEqual({
      host: "127.0.0.1",
      port: 9100
    });

    await rm(sandboxRoot, { recursive: true, force: true });
  });

  test("malformed installed model entries are dropped during normalization", async () => {
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
    await mkdir(dirname(paths.configFilePath), { recursive: true });

    await writeFile(
      paths.configFilePath,
      JSON.stringify({
        asr: {
          languageMode: "auto",
          fixedLanguage: null,
          installedModels: [
            {
              modelId: "whisper-base",
              installedAt: "2026-04-01T00:00:00.000Z",
              sizeBytes: 146000000,
              active: true
            },
            {
              modelId: 123,
              installedAt: "bad",
              sizeBytes: "146000000",
              active: "yes"
            }
          ]
        },
        osc: {
          host: "127.0.0.1",
          port: 9000
        }
      }),
      "utf8"
    );

    await expect(store.read()).resolves.toMatchObject({
      asr: {
        installedModels: [
          {
            modelId: "whisper-base",
            installedAt: "2026-04-01T00:00:00.000Z",
            sizeBytes: 146000000,
            active: true
          }
        ]
      }
    });

    await store.updateOsc((current) => ({ ...current, host: "localhost" }));

    const persisted = JSON.parse(await readFile(paths.configFilePath, "utf8")) as {
      asr: { installedModels: Array<{ modelId: string }> };
      osc: { host: string; port: number };
    };
    expect(persisted.asr.installedModels).toHaveLength(1);
    expect(persisted.asr.installedModels[0]?.modelId).toBe("whisper-base");

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
