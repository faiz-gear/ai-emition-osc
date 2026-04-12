import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vitest";
import { ProviderCrypto } from "../../../runtime/providers/provider-crypto";
import {
  ProviderService,
  ProviderServiceError,
  rotateProviderSecrets,
  type ChatModelLike,
  type ProviderAdapter,
  type ProviderRuntimeConfig
} from "../../../runtime/providers/provider-service";
import { SqliteProviderRepository } from "../../../runtime/providers/provider-repository";

const SECRET_KEY = "0123456789abcdef0123456789abcdef";
const NEXT_SECRET_KEY = "fedcba9876543210fedcba9876543210";

class FakeModel implements ChatModelLike {
  public constructor(private readonly failure?: Error) {}

  async ainvoke(_prompt: string): Promise<unknown> {
    if (this.failure) {
      throw this.failure;
    }
    return { ok: true };
  }
}

class FakeAdapter implements ProviderAdapter {
  public readonly providerType = "ollama";

  public constructor(private readonly model: ChatModelLike) {}

  validate(_config: ProviderRuntimeConfig): void {}

  createModel(_config: ProviderRuntimeConfig): ChatModelLike {
    return this.model;
  }
}

describe("provider service", () => {
  const sandboxes: string[] = [];

  afterEach(async () => {
    await Promise.all(
      sandboxes.splice(0).map((sandboxPath) =>
        rm(sandboxPath, { recursive: true, force: true })
      )
    );
  });

  async function createRepository(): Promise<SqliteProviderRepository> {
    const sandboxPath = await mkdtemp(join(tmpdir(), "provider-service-test-"));
    sandboxes.push(sandboxPath);

    const repository = new SqliteProviderRepository(join(sandboxPath, "providers.sqlite3"));
    await repository.initialize("qwen2.5:3b");
    return repository;
  }

  async function createService(
    overrides: Partial<Record<ProviderRuntimeConfig["provider_type"], ProviderAdapter>> = {}
  ): Promise<{
    repository: SqliteProviderRepository;
    service: ProviderService;
  }> {
    const repository = await createRepository();
    const service = new ProviderService({
      repository,
      crypto: new ProviderCrypto(SECRET_KEY),
      adapters: overrides
    });

    return { repository, service };
  }

  test("persists encrypted secrets and supports CRUD plus activation against SQLite", async () => {
    const { repository, service } = await createService();
    const initialProviders = await service.listSummaries();
    const defaultProvider = initialProviders[0];

    expect(defaultProvider).toMatchObject({
      name: "default-ollama",
      provider_type: "ollama",
      is_active: true
    });

    const created = await service.createProvider({
      name: "OpenAI main",
      provider_type: "openai",
      model: "gpt-4o-mini",
      api_key: "sk-secret",
      headers: {
        Authorization: "Bearer sk-secret"
      },
      temperature: 0.4
    });

    const stored = await repository.get(created.id);
    expect(stored?.api_key_encrypted).toBeTruthy();
    expect(stored?.headers_encrypted).toBeTruthy();
    expect(stored?.api_key_encrypted).not.toContain("sk-secret");
    expect(stored?.headers_encrypted).not.toContain("Authorization");

    const updated = await service.updateProvider(created.id, {
      name: "OpenAI primary",
      model: "gpt-4.1-mini"
    });
    expect(updated.name).toBe("OpenAI primary");
    expect(updated.model).toBe("gpt-4.1-mini");

    const activated = await service.activateProvider(created.id);
    expect(activated.is_active).toBe(true);

    const active = await service.getActiveSummary();
    expect(active.id).toBe(created.id);

    await service.deleteProvider(defaultProvider.id);

    const remaining = await service.listSummaries();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({
      id: created.id,
      is_active: true,
      has_api_key: true,
      headers_keys: ["Authorization"],
      status: "ok"
    });
  });

  test("creates the database parent directory during initialization", async () => {
    const sandboxPath = await mkdtemp(join(tmpdir(), "provider-service-nested-test-"));
    sandboxes.push(sandboxPath);

    const repository = new SqliteProviderRepository(
      join(sandboxPath, "runtime", "nested", "providers.sqlite3")
    );

    await expect(repository.initialize("qwen2.5:3b")).resolves.toBeUndefined();
    await expect(repository.getActive()).resolves.toMatchObject({
      provider_type: "ollama",
      is_active: true
    });
  });

  test("maps provider auth failures to a stable error code", async () => {
    class AuthError extends Error {
      public readonly status_code = 401;
    }

    const { repository } = await createService();
    const active = await repository.getActive();
    const service = new ProviderService({
      repository,
      crypto: new ProviderCrypto(SECRET_KEY),
      adapters: {
        ollama: new FakeAdapter(new FakeModel(new AuthError("unauthorized")))
      }
    });

    await expect(service.testProvider(active!.id)).rejects.toMatchObject<ProviderServiceError>({
      code: "PROVIDER_AUTH_FAILED"
    });
  });

  test("maps provider rate limit failures to a stable error code", async () => {
    class RateLimitError extends Error {
      public readonly status_code = 429;
    }

    const { repository } = await createService();
    const active = await repository.getActive();
    const service = new ProviderService({
      repository,
      crypto: new ProviderCrypto(SECRET_KEY),
      adapters: {
        ollama: new FakeAdapter(new FakeModel(new RateLimitError("too many requests")))
      }
    });

    await expect(service.testProvider(active!.id)).rejects.toMatchObject<ProviderServiceError>({
      code: "PROVIDER_RATE_LIMITED"
    });
  });

  test("maps upstream availability failures to a stable error code", async () => {
    const { repository } = await createService();
    const active = await repository.getActive();
    const service = new ProviderService({
      repository,
      crypto: new ProviderCrypto(SECRET_KEY),
      adapters: {
        ollama: new FakeAdapter(new FakeModel(new Error("connection refused")))
      }
    });

    await expect(service.testProvider(active!.id)).rejects.toMatchObject<ProviderServiceError>({
      code: "PROVIDER_UPSTREAM_UNAVAILABLE"
    });
  });

  test("blocks provider mutations and active runtime access while secret rotation is locked", async () => {
    const { repository, service } = await createService();
    const created = await service.createProvider({
      name: "Locked provider",
      provider_type: "openai",
      model: "gpt-4.1-mini",
      api_key: "sk-secret"
    });

    await repository.setRotationLock(true);

    await expect(service.listSummaries()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: created.id })])
    );

    await expect(
      service.createProvider({
        name: "Blocked create",
        provider_type: "openai",
        model: "gpt-4.1-mini",
        api_key: "sk-blocked"
      })
    ).rejects.toMatchObject<ProviderServiceError>({
      code: "PROVIDER_ROTATION_IN_PROGRESS"
    });

    await expect(
      service.updateProvider(created.id, {
        name: "Blocked update"
      })
    ).rejects.toMatchObject<ProviderServiceError>({
      code: "PROVIDER_ROTATION_IN_PROGRESS"
    });

    await expect(service.deleteProvider(created.id)).rejects.toMatchObject<ProviderServiceError>({
      code: "PROVIDER_ROTATION_IN_PROGRESS"
    });

    await expect(service.activateProvider(created.id)).rejects.toMatchObject<ProviderServiceError>({
      code: "PROVIDER_ROTATION_IN_PROGRESS"
    });

    await expect(service.testProvider(created.id)).rejects.toMatchObject<ProviderServiceError>({
      code: "PROVIDER_ROTATION_IN_PROGRESS"
    });

    await expect(service.getActiveChatModel()).rejects.toMatchObject<ProviderServiceError>({
      code: "PROVIDER_ROTATION_IN_PROGRESS"
    });
  });

  test("re-encrypts provider secrets under a new key and clears the rotation lock", async () => {
    const { repository, service } = await createService();
    const created = await service.createProvider({
      name: "Rotate me",
      provider_type: "openai",
      model: "gpt-4.1-mini",
      api_key: "sk-rotate-me",
      headers: {
        Authorization: "Bearer sk-rotate-me"
      }
    });

    const before = await repository.get(created.id);

    await expect(
      rotateProviderSecrets({
        repository,
        oldCrypto: new ProviderCrypto(SECRET_KEY),
        newCrypto: new ProviderCrypto(NEXT_SECRET_KEY)
      })
    ).resolves.toEqual({
      rotatedProviders: 2
    });

    const after = await repository.get(created.id);
    expect(after?.api_key_encrypted).not.toBe(before?.api_key_encrypted);
    expect(after?.headers_encrypted).not.toBe(before?.headers_encrypted);
    await expect(repository.isRotationLocked()).resolves.toBe(false);

    const rotatedService = new ProviderService({
      repository,
      crypto: new ProviderCrypto(NEXT_SECRET_KEY)
    });

    await expect(rotatedService.getRuntimeConfig(created.id)).resolves.toMatchObject({
      api_key: "sk-rotate-me",
      headers: {
        Authorization: "Bearer sk-rotate-me"
      }
    });

    const staleSummaries = await service.listSummaries();
    const staleRecord = staleSummaries.find((provider) => provider.id === created.id);
    expect(staleRecord).toMatchObject({
      status: "degraded",
      error_code: "PROVIDER_SECRET_DECRYPT_FAILED"
    });
  });

  test("keeps existing ciphertext intact when key rotation fails", async () => {
    const { repository, service } = await createService();
    const created = await service.createProvider({
      name: "Rotation rollback",
      provider_type: "openai",
      model: "gpt-4.1-mini",
      api_key: "sk-rollback"
    });

    const before = await repository.get(created.id);

    await expect(
      rotateProviderSecrets({
        repository,
        oldCrypto: new ProviderCrypto("wrong-old-secret"),
        newCrypto: new ProviderCrypto(NEXT_SECRET_KEY)
      })
    ).rejects.toThrow(/decrypt/i);

    const after = await repository.get(created.id);
    expect(after?.api_key_encrypted).toBe(before?.api_key_encrypted);
    await expect(repository.isRotationLocked()).resolves.toBe(false);
    await expect(service.getRuntimeConfig(created.id)).resolves.toMatchObject({
      api_key: "sk-rollback"
    });
  });
});
