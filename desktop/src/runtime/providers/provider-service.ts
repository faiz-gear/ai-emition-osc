import type {
  CreateProviderRequest,
  ProviderErrorCode,
  ProviderSummary,
  ProviderTestResult,
  ProviderType
} from "@ai-emotion/contracts";
import { OllamaAdapter } from "./adapters/ollama";
import { OpenAIAdapter } from "./adapters/openai";
import { OpenAICompatibleAdapter } from "./adapters/openai-compatible";
import { ProviderCrypto } from "./provider-crypto";
import type {
  SqliteProviderRepository,
  StoredProviderPatch,
  StoredProviderRecord,
  StoredProviderSecretCiphertext,
  StoredProviderWrite
} from "./provider-repository";

export type ChatModelLike = {
  ainvoke(prompt: string): Promise<unknown>;
  withStructuredOutput?(schema: unknown): {
    ainvoke(prompt: string): Promise<unknown>;
  };
};

export type ProviderRuntimeConfig = {
  id: string;
  name: string;
  provider_type: ProviderType;
  provider_key: string | null;
  model: string;
  base_url: string | null;
  headers: Record<string, string> | null;
  api_key: string | null;
  temperature: number | null;
  is_active: boolean;
};

export type ProviderAdapter = {
  readonly providerType: ProviderType;
  validate(config: ProviderRuntimeConfig): void;
  createModel(config: ProviderRuntimeConfig): ChatModelLike;
};

export class ProviderServiceError extends Error {
  public constructor(
    public readonly code: ProviderErrorCode,
    message: string,
    public readonly details: Record<string, unknown> = {},
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ProviderServiceError";
  }
}

type ProviderServiceOptions = {
  repository: SqliteProviderRepository;
  crypto: ProviderCrypto;
  adapters?: Partial<Record<ProviderType, ProviderAdapter>>;
};

type DecryptedSecrets = {
  apiKey: string | null;
  headers: Record<string, string> | null;
};

const DEFAULT_ADAPTERS: Record<ProviderType, ProviderAdapter> = {
  ollama: new OllamaAdapter(),
  openai: new OpenAIAdapter(),
  openai_compatible: new OpenAICompatibleAdapter()
};

export class ProviderService {
  private readonly adapters: Record<ProviderType, ProviderAdapter>;

  public constructor(private readonly options: ProviderServiceOptions) {
    this.adapters = {
      ...DEFAULT_ADAPTERS,
      ...options.adapters
    };
  }

  public async listSummaries(): Promise<ProviderSummary[]> {
    const records = await this.options.repository.list();
    return records.map((record) => {
      try {
        const decrypted = this.decryptSecrets(record);
        return this.summaryFromPlain(record, decrypted);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Provider secret cannot be decrypted";
        return {
          id: record.id,
          name: record.name,
          provider_type: record.provider_type,
          provider_key: record.provider_key,
          model: record.model,
          base_url: record.base_url,
          temperature: record.temperature,
          is_active: record.is_active,
          updated_at: record.updated_at,
          has_api_key: null,
          headers_keys: null,
          status: "degraded",
          error_code: "PROVIDER_SECRET_DECRYPT_FAILED",
          error_message: message
        };
      }
    });
  }

  public async createProvider(input: CreateProviderRequest): Promise<ProviderSummary> {
    await this.assertMutationsAllowed();
    const normalized = normalizeProviderInput(input);
    let stored: StoredProviderRecord;

    try {
      stored = await this.options.repository.create({
        ...encryptSecrets(this.options.crypto, normalized),
        name: normalized.name,
        provider_type: normalized.provider_type,
        provider_key: normalized.provider_key,
        model: normalized.model,
        base_url: normalized.base_url,
        temperature: normalized.temperature,
        is_active: false
      } satisfies StoredProviderWrite);
    } catch (error) {
      throw rethrowProviderRepositoryError(error);
    }

    return this.summaryFromPlain(stored, {
      apiKey: normalized.api_key,
      headers: normalized.headers
    });
  }

  public async updateProvider(
    providerId: string,
    patch: Partial<CreateProviderRequest>
  ): Promise<ProviderSummary> {
    await this.assertMutationsAllowed();
    if ("provider_type" in patch) {
      throw new ProviderServiceError(
        "PROVIDER_TYPE_IMMUTABLE",
        "Provider type cannot be changed"
      );
    }

    const existing = await this.options.repository.get(providerId);
    if (!existing) {
      throw new ProviderServiceError("PROVIDER_NOT_FOUND", "Provider does not exist");
    }

    const current = this.decryptSecrets(existing);
    const normalized = normalizeProviderInput({
      name: hasOwn(patch, "name") ? patch.name ?? "" : existing.name,
      provider_type: existing.provider_type,
      provider_key: hasOwn(patch, "provider_key") ? patch.provider_key ?? null : existing.provider_key,
      model: hasOwn(patch, "model") ? patch.model ?? "" : existing.model,
      base_url: hasOwn(patch, "base_url") ? patch.base_url ?? null : existing.base_url,
      temperature: hasOwn(patch, "temperature")
        ? patch.temperature ?? null
        : existing.temperature,
      api_key: hasOwn(patch, "api_key") ? patch.api_key ?? null : current.apiKey,
      headers: hasOwn(patch, "headers") ? patch.headers ?? null : current.headers
    });

    const updatePatch: StoredProviderPatch = {};
    if ("name" in patch) {
      updatePatch.name = normalized.name;
    }
    if ("provider_key" in patch) {
      updatePatch.provider_key = normalized.provider_key;
    }
    if ("model" in patch) {
      updatePatch.model = normalized.model;
    }
    if ("base_url" in patch) {
      updatePatch.base_url = normalized.base_url;
    }
    if ("temperature" in patch) {
      updatePatch.temperature = normalized.temperature;
    }
    if ("api_key" in patch) {
      updatePatch.api_key_encrypted = normalized.api_key
        ? this.options.crypto.encryptText(normalized.api_key)
        : null;
    }
    if ("headers" in patch) {
      updatePatch.headers_encrypted = normalized.headers
        ? this.options.crypto.encryptJson(normalized.headers)
        : null;
    }

    let updated: StoredProviderRecord;
    try {
      updated = await this.options.repository.update(providerId, updatePatch);
    } catch (error) {
      throw rethrowProviderRepositoryError(error);
    }

    return this.summaryFromPlain(updated, {
      apiKey: normalized.api_key,
      headers: normalized.headers
    });
  }

  public async deleteProvider(providerId: string): Promise<void> {
    await this.assertMutationsAllowed();
    const deleted = await this.options.repository.delete(providerId);
    if (!deleted) {
      throw new ProviderServiceError("PROVIDER_NOT_FOUND", "Provider does not exist");
    }
  }

  public async activateProvider(providerId: string): Promise<ProviderSummary> {
    await this.assertMutationsAllowed();
    const runtime = await this.getRuntimeConfig(providerId);
    const adapter = this.getAdapter(runtime.provider_type);
    adapter.validate(runtime);

    let updated: StoredProviderRecord;
    try {
      updated = await this.options.repository.setActive(providerId);
    } catch (error) {
      throw rethrowProviderRepositoryError(error);
    }

    return this.summaryFromPlain(updated, {
      apiKey: runtime.api_key,
      headers: runtime.headers
    });
  }

  public async testProvider(providerId: string): Promise<ProviderTestResult> {
    await this.assertMutationsAllowed();
    const startedAt = performance.now();
    const runtime = await this.getRuntimeConfig(providerId);
    const adapter = this.getAdapter(runtime.provider_type);
    adapter.validate(runtime);
    const model = adapter.createModel(runtime);

    try {
      await model.ainvoke('Respond with a short JSON object: {"ok": true}');
    } catch (error) {
      throw mapProviderTestError(error);
    }

    return {
      ok: true,
      latency_ms: performance.now() - startedAt
    };
  }

  public async getActiveSummary(): Promise<ProviderSummary> {
    const active = await this.options.repository.getActive();
    if (!active) {
      throw new ProviderServiceError(
        "PROVIDER_ACTIVE_NOT_SET",
        "No active provider configured"
      );
    }
    return this.summaryFromPlain(active, this.decryptSecrets(active));
  }

  public async getActiveChatModel(): Promise<ChatModelLike> {
    await this.assertMutationsAllowed();
    const active = await this.options.repository.getActive();
    if (!active) {
      throw new ProviderServiceError(
        "PROVIDER_ACTIVE_NOT_SET",
        "No active provider configured"
      );
    }

    const runtime = this.runtimeFromRecord(active);
    const adapter = this.getAdapter(runtime.provider_type);
    adapter.validate(runtime);
    return adapter.createModel(runtime);
  }

  public async getRuntimeConfig(providerId: string): Promise<ProviderRuntimeConfig> {
    const record = await this.options.repository.get(providerId);
    if (!record) {
      throw new ProviderServiceError("PROVIDER_NOT_FOUND", "Provider does not exist");
    }

    return this.runtimeFromRecord(record);
  }

  private getAdapter(providerType: ProviderType): ProviderAdapter {
    return this.adapters[providerType];
  }

  private async assertMutationsAllowed(): Promise<void> {
    if (await this.options.repository.isRotationLocked()) {
      throw new ProviderServiceError(
        "PROVIDER_ROTATION_IN_PROGRESS",
        "Provider secret rotation is in progress"
      );
    }
  }

  private runtimeFromRecord(record: StoredProviderRecord): ProviderRuntimeConfig {
    const decrypted = this.decryptSecrets(record);

    return {
      id: record.id,
      name: record.name,
      provider_type: record.provider_type,
      provider_key: record.provider_key,
      model: record.model,
      base_url: record.base_url,
      headers: decrypted.headers,
      api_key: decrypted.apiKey,
      temperature: record.temperature,
      is_active: record.is_active
    };
  }

  private decryptSecrets(record: StoredProviderRecord): DecryptedSecrets {
    try {
      return decryptProviderSecrets(this.options.crypto, record);
    } catch (error) {
      throw new ProviderServiceError(
        "PROVIDER_SECRET_DECRYPT_FAILED",
        "Provider secret cannot be decrypted",
        {},
        { cause: error }
      );
    }
  }

  private summaryFromPlain(
    record: StoredProviderRecord,
    decrypted: DecryptedSecrets
  ): ProviderSummary {
    return {
      id: record.id,
      name: record.name,
      provider_type: record.provider_type,
      provider_key: record.provider_key,
      model: record.model,
      base_url: record.base_url,
      temperature: record.temperature,
      is_active: record.is_active,
      updated_at: record.updated_at,
      has_api_key: decrypted.apiKey !== null,
      headers_keys: decrypted.headers ? Object.keys(decrypted.headers).sort() : [],
      status: "ok",
      error_code: null,
      error_message: null
    };
  }
}

export async function rotateProviderSecrets(options: {
  repository: SqliteProviderRepository;
  oldCrypto: ProviderCrypto;
  newCrypto: ProviderCrypto;
}): Promise<{ rotatedProviders: number }> {
  if (!(await options.repository.hasProviderSchema())) {
    throw new Error("Provider DB schema is not initialized");
  }

  if (await options.repository.isRotationLocked()) {
    throw new ProviderServiceError(
      "PROVIDER_ROTATION_IN_PROGRESS",
      "Provider secret rotation is already in progress"
    );
  }

  await options.repository.setRotationLock(true);

  try {
    const rotatedProviders = await options.repository.rotateSecrets((record) =>
      reencryptProviderSecrets(options.oldCrypto, options.newCrypto, record)
    );

    return { rotatedProviders };
  } finally {
    await options.repository.setRotationLock(false);
  }
}

function normalizeProviderInput(input: Partial<CreateProviderRequest> & {
  name: string;
  provider_type: ProviderType;
  model: string;
}): {
  name: string;
  provider_type: ProviderType;
  provider_key: string | null;
  model: string;
  base_url: string | null;
  temperature: number | null;
  api_key: string | null;
  headers: Record<string, string> | null;
} {
  const name = input.name.trim();
  const model = input.model.trim();
  if (name === "") {
    throw new ProviderServiceError(
      "PROVIDER_VALIDATION_FAILED",
      "Provider name must not be empty"
    );
  }
  if (model === "") {
    throw new ProviderServiceError(
      "PROVIDER_VALIDATION_FAILED",
      "Provider model must not be empty"
    );
  }
  if (input.temperature !== null && input.temperature !== undefined) {
    if (!Number.isFinite(input.temperature) || input.temperature < 0 || input.temperature > 2) {
      throw new ProviderServiceError(
        "PROVIDER_VALIDATION_FAILED",
        "temperature must be between 0 and 2"
      );
    }
  }

  let provider_key =
    typeof input.provider_key === "string" && input.provider_key.trim() !== ""
      ? input.provider_key.trim()
      : null;
  let base_url =
    typeof input.base_url === "string" && input.base_url.trim() !== ""
      ? input.base_url.trim()
      : null;
  let api_key =
    typeof input.api_key === "string" && input.api_key.trim() !== ""
      ? input.api_key.trim()
      : null;
  let headers =
    input.headers && Object.keys(input.headers).length > 0 ? sanitizeHeaders(input.headers) : null;

  switch (input.provider_type) {
    case "ollama":
      provider_key = null;
      api_key = null;
      headers = null;
      break;
    case "openai":
      provider_key = null;
      if (!api_key) {
        throw new ProviderServiceError(
          "PROVIDER_VALIDATION_FAILED",
          "openai provider requires api_key"
        );
      }
      break;
    case "openai_compatible":
      if (!provider_key) {
        throw new ProviderServiceError(
          "PROVIDER_VALIDATION_FAILED",
          "openai_compatible provider requires provider_key"
        );
      }
      if (!base_url) {
        throw new ProviderServiceError(
          "PROVIDER_VALIDATION_FAILED",
          "openai_compatible provider requires base_url"
        );
      }
      break;
    default:
      throw new ProviderServiceError(
        "PROVIDER_VALIDATION_FAILED",
        "unsupported provider_type"
      );
  }

  return {
    name,
    provider_type: input.provider_type,
    provider_key,
    model,
    base_url,
    temperature: typeof input.temperature === "number" ? input.temperature : null,
    api_key,
    headers
  };
}

function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers)
      .map(([key, value]) => [key.trim(), value.trim()] as const)
      .filter(([key, value]) => key !== "" && value !== "")
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

function encryptSecrets(
  crypto: ProviderCrypto,
  input: {
    api_key: string | null;
    headers: Record<string, string> | null;
  }
): StoredProviderSecretCiphertext {
  return {
    api_key_encrypted: input.api_key ? crypto.encryptText(input.api_key) : null,
    headers_encrypted: input.headers ? crypto.encryptJson(input.headers) : null
  };
}

function decryptProviderSecrets(
  crypto: ProviderCrypto,
  record: Pick<StoredProviderRecord, "api_key_encrypted" | "headers_encrypted">
): DecryptedSecrets {
  return {
    apiKey: record.api_key_encrypted ? crypto.decryptText(record.api_key_encrypted) : null,
    headers: record.headers_encrypted ? crypto.decryptJson(record.headers_encrypted) : null
  };
}

function reencryptProviderSecrets(
  oldCrypto: ProviderCrypto,
  newCrypto: ProviderCrypto,
  record: Pick<StoredProviderRecord, "api_key_encrypted" | "headers_encrypted">
): StoredProviderSecretCiphertext {
  const decrypted = decryptProviderSecrets(oldCrypto, record);

  return encryptSecrets(newCrypto, {
    api_key: decrypted.apiKey,
    headers: decrypted.headers
  });
}

function mapProviderTestError(error: unknown): ProviderServiceError {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  const statusCode =
    error && typeof error === "object" && "status_code" in error
      ? (error as { status_code?: unknown }).status_code
      : undefined;

  if (statusCode === 401 || statusCode === 403 || message.includes("unauthorized") || message.includes("forbidden")) {
    return new ProviderServiceError("PROVIDER_AUTH_FAILED", "Provider authentication failed", {}, { cause: error instanceof Error ? error : undefined });
  }
  if (statusCode === 429 || message.includes("rate limit") || message.includes("too many requests")) {
    return new ProviderServiceError("PROVIDER_RATE_LIMITED", "Provider rate limited request", {}, { cause: error instanceof Error ? error : undefined });
  }

  return new ProviderServiceError(
    "PROVIDER_UPSTREAM_UNAVAILABLE",
    error instanceof Error ? error.message : "Provider upstream is unavailable",
    {},
    { cause: error instanceof Error ? error : undefined }
  );
}

function rethrowProviderRepositoryError(error: unknown): ProviderServiceError {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("not found")) {
    return new ProviderServiceError("PROVIDER_NOT_FOUND", "Provider does not exist");
  }

  return new ProviderServiceError(
    "PROVIDER_CONFLICT",
    "Provider conflicts with existing configuration",
    {},
    { cause: error instanceof Error ? error : undefined }
  );
}

function hasOwn<T extends object, K extends PropertyKey>(
  value: T,
  key: K
): value is T & Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(value, key);
}
