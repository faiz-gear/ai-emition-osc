import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { app as electronApp } from "electron";
import type { InstalledAsrModel } from "@ai-emotion/contracts";

export type AppConfig = {
  asr: {
    currentModelId: string | null;
    languageMode: "auto" | "fixed";
    fixedLanguage: "zh" | "en" | null;
    installedModels: InstalledAsrModel[];
  };
  osc: {
    host: string;
    port: number;
  };
};

export type AppConfigPaths = {
  appPath: string;
  appDataPath: string;
  userDataPath: string;
  runtimeRootPath: string;
  configFilePath: string;
  providerDbPath: string;
  asrModelRootPath: string;
};

export type ElectronAppPathAdapter = {
  getPath(name: "appData" | "userData"): string;
  getAppPath(): string;
};

export type CreateAppConfigStoreOptions = {
  app?: ElectronAppPathAdapter;
};

export type AppConfigStore = {
  getPaths(): AppConfigPaths;
  read(): Promise<AppConfig>;
  updateAsr(
    updater: (current: AppConfig["asr"]) => AppConfig["asr"]
  ): Promise<AppConfig["asr"]>;
  updateOsc(
    updater: (current: AppConfig["osc"]) => AppConfig["osc"]
  ): Promise<AppConfig["osc"]>;
};

const defaultConfig: AppConfig = {
  asr: {
    currentModelId: null,
    languageMode: "auto",
    fixedLanguage: null,
    installedModels: []
  },
  osc: {
    host: "127.0.0.1",
    port: 9000
  }
};

export function resolveAppConfigPaths(app: ElectronAppPathAdapter = electronApp): AppConfigPaths {
  const appDataPath = app.getPath("appData");
  const userDataPath = app.getPath("userData");
  const runtimeRootPath = join(userDataPath, "runtime");

  return {
    appPath: app.getAppPath(),
    appDataPath,
    userDataPath,
    runtimeRootPath,
    configFilePath: join(runtimeRootPath, "app-config.json"),
    providerDbPath: join(runtimeRootPath, "providers.sqlite3"),
    asrModelRootPath: join(runtimeRootPath, "asr-models")
  };
}

export function createAppConfigStore(options: CreateAppConfigStoreOptions = {}): AppConfigStore {
  const paths = resolveAppConfigPaths(options.app ?? electronApp);

  async function persistConfig(config: AppConfig): Promise<void> {
    await mkdir(dirname(paths.configFilePath), { recursive: true });
    await writeFile(paths.configFilePath, JSON.stringify(config, null, 2), "utf8");
  }

  async function readConfig(): Promise<AppConfig> {
    try {
      const raw = await readFile(paths.configFilePath, "utf8");
      return normalizeConfig(JSON.parse(raw));
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return cloneDefaultConfig();
      }
      throw error;
    }
  }

  async function updateConfig(updater: (current: AppConfig) => AppConfig): Promise<AppConfig> {
    const current = await readConfig();
    const next = updater(current);
    await persistConfig(next);
    return next;
  }

  return {
    getPaths() {
      return { ...paths };
    },
    read() {
      return readConfig();
    },
    async updateAsr(updater) {
      const next = await updateConfig((current) => ({
        ...current,
        asr: updater(current.asr)
      }));
      return next.asr;
    },
    async updateOsc(updater) {
      const next = await updateConfig((current) => ({
        ...current,
        osc: updater(current.osc)
      }));
      return next.osc;
    }
  };
}

function cloneDefaultConfig(): AppConfig {
  return JSON.parse(JSON.stringify(defaultConfig)) as AppConfig;
}

function normalizeConfig(input: unknown): AppConfig {
  const candidate = input as Partial<AppConfig> | null;
  const config = cloneDefaultConfig();

  if (!candidate || typeof candidate !== "object") {
    return config;
  }

  if (candidate.asr && typeof candidate.asr === "object") {
    if (typeof candidate.asr.currentModelId === "string" || candidate.asr.currentModelId === null) {
      config.asr.currentModelId = candidate.asr.currentModelId;
    }
    if (candidate.asr.languageMode === "auto" || candidate.asr.languageMode === "fixed") {
      config.asr.languageMode = candidate.asr.languageMode;
    }
    if (
      candidate.asr.fixedLanguage === null ||
      candidate.asr.fixedLanguage === "zh" ||
      candidate.asr.fixedLanguage === "en"
    ) {
      config.asr.fixedLanguage = candidate.asr.fixedLanguage;
    }
    if (Array.isArray(candidate.asr.installedModels)) {
      config.asr.installedModels = candidate.asr.installedModels;
    }
  }

  if (candidate.osc && typeof candidate.osc === "object") {
    if (typeof candidate.osc.host === "string") {
      config.osc.host = candidate.osc.host;
    }
    if (typeof candidate.osc.port === "number") {
      config.osc.port = candidate.osc.port;
    }
  }

  if (config.asr.languageMode === "auto") {
    config.asr.fixedLanguage = null;
  }

  if (config.asr.languageMode === "fixed" && !config.asr.fixedLanguage) {
    config.asr.languageMode = "auto";
  }

  return config;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return !!error && typeof error === "object" && "code" in error;
}
