import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ConfigModule = typeof import("../config");

const ORIGINAL_API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const ORIGINAL_WS_URL = process.env.NEXT_PUBLIC_WS_URL;

async function loadConfigModule(env?: { apiBase?: string; wsUrl?: string }) {
  if (env?.apiBase === undefined) {
    delete process.env.NEXT_PUBLIC_API_BASE;
  } else {
    process.env.NEXT_PUBLIC_API_BASE = env.apiBase;
  }

  if (env?.wsUrl === undefined) {
    delete process.env.NEXT_PUBLIC_WS_URL;
  } else {
    process.env.NEXT_PUBLIC_WS_URL = env.wsUrl;
  }

  vi.resetModules();
  return (await import("../config")) as ConfigModule;
}

describe("runtime config contracts", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (ORIGINAL_API_BASE === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE;
    } else {
      process.env.NEXT_PUBLIC_API_BASE = ORIGINAL_API_BASE;
    }

    if (ORIGINAL_WS_URL === undefined) {
      delete process.env.NEXT_PUBLIC_WS_URL;
    } else {
      process.env.NEXT_PUBLIC_WS_URL = ORIGINAL_WS_URL;
    }
  });

  it("loads env defaults and exports storage key constants", async () => {
    const config = await loadConfigModule();
    const result = config.loadRuntimeConfig();

    expect(config.RUNTIME_CONFIG_STORAGE_KEY).toBe("ai-emotion::runtime-config::v1");
    expect(config.API_BASE).toBe(config.DEFAULT_RUNTIME_CONFIG.apiBase);
    expect(config.WS_URL).toBe(config.DEFAULT_RUNTIME_CONFIG.wsUrl);
    expect(result.source).toBe("env_default");
    expect(result.warningCode).toBeNull();
    expect(result.config).toEqual(config.DEFAULT_RUNTIME_CONFIG);
  });

  it("loads persisted config and marks local_storage source", async () => {
    const config = await loadConfigModule();
    localStorage.setItem(
      config.RUNTIME_CONFIG_STORAGE_KEY,
      JSON.stringify({
        version: config.RUNTIME_CONFIG_VERSION,
        apiBase: "https://example.test",
        wsUrl: "wss://example.test/ws/events",
      }),
    );

    const result = config.loadRuntimeConfig();
    expect(result.source).toBe("local_storage");
    expect(result.warningCode).toBeNull();
    expect(result.config).toEqual({
      apiBase: "https://example.test",
      wsUrl: "wss://example.test/ws/events",
    });
  });

  it("falls back with invalid_json warning when localStorage payload is broken JSON", async () => {
    const config = await loadConfigModule();
    localStorage.setItem(config.RUNTIME_CONFIG_STORAGE_KEY, "{not-json");

    const result = config.loadRuntimeConfig();
    expect(result.source).toBe("env_default");
    expect(result.warningCode).toBe("invalid_json");
    expect(result.config).toEqual(config.DEFAULT_RUNTIME_CONFIG);
  });

  it("falls back with invalid_shape warning when localStorage payload shape is invalid", async () => {
    const config = await loadConfigModule();
    localStorage.setItem(
      config.RUNTIME_CONFIG_STORAGE_KEY,
      JSON.stringify({
        version: config.RUNTIME_CONFIG_VERSION,
        apiBase: 123,
      }),
    );

    const result = config.loadRuntimeConfig();
    expect(result.source).toBe("env_default");
    expect(result.warningCode).toBe("invalid_shape");
  });

  it("falls back with version_mismatch warning when persisted version differs", async () => {
    const config = await loadConfigModule();
    localStorage.setItem(
      config.RUNTIME_CONFIG_STORAGE_KEY,
      JSON.stringify({
        version: config.RUNTIME_CONFIG_VERSION + 1,
        apiBase: "https://example.test",
        wsUrl: "wss://example.test/ws/events",
      }),
    );

    const result = config.loadRuntimeConfig();
    expect(result.source).toBe("env_default");
    expect(result.warningCode).toBe("version_mismatch");
  });

  it("uses safe defaults with invalid_env_default warning when env defaults are invalid", async () => {
    const config = await loadConfigModule({
      apiBase: "ftp://bad",
      wsUrl: "http://bad",
    });
    const result = config.loadRuntimeConfig();

    expect(result.source).toBe("env_default");
    expect(result.warningCode).toBe("invalid_env_default");
    expect(result.config).toEqual(config.SAFE_DEFAULT_RUNTIME_CONFIG);
    expect(config.DEFAULT_RUNTIME_CONFIG).toEqual(config.SAFE_DEFAULT_RUNTIME_CONFIG);
  });

  it("validates runtime config URL schemes", async () => {
    const config = await loadConfigModule();

    expect(
      config.validateRuntimeConfigInput({
        apiBase: "http://ok.test",
        wsUrl: "wss://ok.test/ws/events",
      }),
    ).toEqual([]);

    const errors = config.validateRuntimeConfigInput({
      apiBase: "ftp://bad",
      wsUrl: "http://bad",
    });
    expect(errors.map((error) => error.code)).toEqual([
      "invalid_api_base",
      "invalid_ws_url",
    ]);
  });

  it("saves and resets runtime config with deterministic action results", async () => {
    const config = await loadConfigModule();
    const saveResult = config.saveRuntimeConfig({
      apiBase: "https://save.test",
      wsUrl: "wss://save.test/ws/events",
    });
    expect(saveResult.ok).toBe(true);
    expect(saveResult.warningCode).toBeNull();
    expect(saveResult.validationErrors).toEqual([]);
    expect(saveResult.persisted).toBe(true);

    const payload = JSON.parse(
      localStorage.getItem(config.RUNTIME_CONFIG_STORAGE_KEY) ?? "{}",
    ) as {
      version: number;
      apiBase: string;
      wsUrl: string;
    };
    expect(payload.version).toBe(config.RUNTIME_CONFIG_VERSION);
    expect(payload.apiBase).toBe("https://save.test");
    expect(payload.wsUrl).toBe("wss://save.test/ws/events");

    const invalidSave = config.saveRuntimeConfig({
      apiBase: "bad",
      wsUrl: "still-bad",
    });
    expect(invalidSave.ok).toBe(false);
    expect(invalidSave.validationErrors.length).toBe(2);

    const resetResult = config.resetRuntimeConfigToDefault();
    expect(resetResult.ok).toBe(true);
    expect(resetResult.config).toEqual(config.DEFAULT_RUNTIME_CONFIG);
    expect(localStorage.getItem(config.RUNTIME_CONFIG_STORAGE_KEY)).toBeNull();
  });

  it("gracefully handles unavailable localStorage for load/save/reset", async () => {
    const config = await loadConfigModule();
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("storage disabled");
    });

    expect(() => config.loadRuntimeConfig()).not.toThrow();
    const loadResult = config.loadRuntimeConfig();
    expect(loadResult.source).toBe("env_default");
    expect(loadResult.warningCode).toBe("storage_unavailable");

    const saveResult = config.saveRuntimeConfig({
      apiBase: "https://save.test",
      wsUrl: "wss://save.test/ws/events",
    });
    expect(saveResult.ok).toBe(true);
    expect(saveResult.persisted).toBe(false);
    expect(saveResult.warningCode).toBe("storage_unavailable");

    const resetResult = config.resetRuntimeConfigToDefault();
    expect(resetResult.ok).toBe(true);
    expect(resetResult.persisted).toBe(false);
  });
});
