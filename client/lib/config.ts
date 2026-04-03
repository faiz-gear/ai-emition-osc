export const RUNTIME_CONFIG_VERSION = 1;
export const RUNTIME_CONFIG_STORAGE_KEY = "ai-emotion::runtime-config::v1";
export const RUNTIME_WARNING_DISMISSED_STORAGE_KEY =
  "ai-emotion::runtime-warning-dismissed::v1";

export type RuntimeConfig = {
  apiBase: string;
  wsUrl: string;
};

export type RuntimeWarningCode =
  | "invalid_json"
  | "invalid_shape"
  | "version_mismatch"
  | "invalid_env_default"
  | "storage_unavailable";

export type RuntimeConfigValidationError = {
  field: keyof RuntimeConfig;
  code: "invalid_api_base" | "invalid_ws_url";
  message: string;
};

export type RuntimeConfigLoadResult = {
  config: RuntimeConfig;
  source: "local_storage" | "env_default";
  warningCode: RuntimeWarningCode | null;
};

export type RuntimeConfigActionResult = {
  ok: boolean;
  config: RuntimeConfig;
  warningCode: RuntimeWarningCode | null;
  validationErrors: RuntimeConfigValidationError[];
  persisted: boolean;
  errorMessage: string | null;
};

type PersistedRuntimeConfig = RuntimeConfig & {
  version: number;
};

export const SAFE_DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  apiBase: "http://127.0.0.1:8000",
  wsUrl: "ws://127.0.0.1:8000/ws/events",
};

function normalizeRuntimeConfig(config: RuntimeConfig): RuntimeConfig {
  return {
    apiBase: config.apiBase.trim(),
    wsUrl: config.wsUrl.trim(),
  };
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function validateRuntimeConfigInput(
  config: RuntimeConfig,
): RuntimeConfigValidationError[] {
  const normalized = normalizeRuntimeConfig(config);
  const errors: RuntimeConfigValidationError[] = [];

  if (!/^https?:\/\//i.test(normalized.apiBase)) {
    errors.push({
      field: "apiBase",
      code: "invalid_api_base",
      message: "API base URL must use http:// or https://",
    });
  }

  if (!/^wss?:\/\//i.test(normalized.wsUrl)) {
    errors.push({
      field: "wsUrl",
      code: "invalid_ws_url",
      message: "WebSocket URL must use ws:// or wss://",
    });
  }

  return errors;
}

function resolveEnvDefaultRuntimeConfig(): {
  config: RuntimeConfig;
  warningCode: RuntimeWarningCode | null;
} {
  const envCandidate = normalizeRuntimeConfig({
    apiBase: process.env.NEXT_PUBLIC_API_BASE ?? SAFE_DEFAULT_RUNTIME_CONFIG.apiBase,
    wsUrl: process.env.NEXT_PUBLIC_WS_URL ?? SAFE_DEFAULT_RUNTIME_CONFIG.wsUrl,
  });

  const errors = validateRuntimeConfigInput(envCandidate);
  if (errors.length > 0) {
    return {
      config: SAFE_DEFAULT_RUNTIME_CONFIG,
      warningCode: "invalid_env_default",
    };
  }

  return {
    config: envCandidate,
    warningCode: null,
  };
}

export const DEFAULT_RUNTIME_CONFIG = resolveEnvDefaultRuntimeConfig().config;
export const API_BASE = DEFAULT_RUNTIME_CONFIG.apiBase;
export const WS_URL = DEFAULT_RUNTIME_CONFIG.wsUrl;

function fallbackLoadResult(
  warningCode: RuntimeWarningCode | null,
): RuntimeConfigLoadResult {
  const envResolved = resolveEnvDefaultRuntimeConfig();
  return {
    config: envResolved.config,
    source: "env_default",
    warningCode: warningCode ?? envResolved.warningCode,
  };
}

export function loadRuntimeConfig(): RuntimeConfigLoadResult {
  const storage = getStorage();
  if (!storage) {
    return fallbackLoadResult("storage_unavailable");
  }

  const raw = storage.getItem(RUNTIME_CONFIG_STORAGE_KEY);
  if (!raw) {
    return fallbackLoadResult(null);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallbackLoadResult("invalid_json");
  }

  if (!parsed || typeof parsed !== "object") {
    return fallbackLoadResult("invalid_shape");
  }

  const candidate = parsed as Partial<PersistedRuntimeConfig>;
  if (candidate.version !== RUNTIME_CONFIG_VERSION) {
    return fallbackLoadResult("version_mismatch");
  }

  if (typeof candidate.apiBase !== "string" || typeof candidate.wsUrl !== "string") {
    return fallbackLoadResult("invalid_shape");
  }

  const normalized = normalizeRuntimeConfig({
    apiBase: candidate.apiBase,
    wsUrl: candidate.wsUrl,
  });
  if (validateRuntimeConfigInput(normalized).length > 0) {
    return fallbackLoadResult("invalid_shape");
  }

  return {
    config: normalized,
    source: "local_storage",
    warningCode: null,
  };
}

export function saveRuntimeConfig(config: RuntimeConfig): RuntimeConfigActionResult {
  const normalized = normalizeRuntimeConfig(config);
  const validationErrors = validateRuntimeConfigInput(normalized);
  if (validationErrors.length > 0) {
    return {
      ok: false,
      config: normalized,
      warningCode: null,
      validationErrors,
      persisted: false,
      errorMessage: "Validation failed",
    };
  }

  const storage = getStorage();
  if (!storage) {
    return {
      ok: true,
      config: normalized,
      warningCode: "storage_unavailable",
      validationErrors: [],
      persisted: false,
      errorMessage: "Unable to persist runtime config",
    };
  }

  try {
    const payload: PersistedRuntimeConfig = {
      version: RUNTIME_CONFIG_VERSION,
      apiBase: normalized.apiBase,
      wsUrl: normalized.wsUrl,
    };
    storage.setItem(RUNTIME_CONFIG_STORAGE_KEY, JSON.stringify(payload));
    return {
      ok: true,
      config: normalized,
      warningCode: null,
      validationErrors: [],
      persisted: true,
      errorMessage: null,
    };
  } catch {
    return {
      ok: true,
      config: normalized,
      warningCode: "storage_unavailable",
      validationErrors: [],
      persisted: false,
      errorMessage: "Unable to persist runtime config",
    };
  }
}

export function resetRuntimeConfigToDefault(): RuntimeConfigActionResult {
  const envResolved = resolveEnvDefaultRuntimeConfig();
  const storage = getStorage();
  if (!storage) {
    return {
      ok: true,
      config: envResolved.config,
      warningCode: envResolved.warningCode ?? "storage_unavailable",
      validationErrors: [],
      persisted: false,
      errorMessage: "Unable to persist runtime config",
    };
  }

  try {
    storage.removeItem(RUNTIME_CONFIG_STORAGE_KEY);
    return {
      ok: true,
      config: envResolved.config,
      warningCode: envResolved.warningCode,
      validationErrors: [],
      persisted: true,
      errorMessage: null,
    };
  } catch {
    return {
      ok: true,
      config: envResolved.config,
      warningCode: envResolved.warningCode ?? "storage_unavailable",
      validationErrors: [],
      persisted: false,
      errorMessage: "Unable to persist runtime config",
    };
  }
}
