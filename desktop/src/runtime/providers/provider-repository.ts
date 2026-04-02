import Database from "better-sqlite3";
import type { ProviderType } from "@ai-emotion/contracts";

const PROVIDER_SCHEMA_VERSION = 1;

export type StoredProviderRecord = {
  id: string;
  name: string;
  provider_type: ProviderType;
  provider_key: string | null;
  model: string;
  base_url: string | null;
  headers_encrypted: string | null;
  api_key_encrypted: string | null;
  temperature: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type StoredProviderWrite = {
  name: string;
  provider_type: ProviderType;
  provider_key?: string | null;
  model: string;
  base_url?: string | null;
  headers_encrypted?: string | null;
  api_key_encrypted?: string | null;
  temperature?: number | null;
  is_active?: boolean;
};

export type StoredProviderPatch = Partial<
  Pick<
    StoredProviderRecord,
    | "name"
    | "provider_key"
    | "model"
    | "base_url"
    | "headers_encrypted"
    | "api_key_encrypted"
    | "temperature"
    | "is_active"
  >
>;

type ProviderConfigRow = StoredProviderRecord & {
  is_active: 0 | 1;
};

export class SqliteProviderRepository {
  private readonly database: Database.Database;

  public constructor(private readonly dbPath: string) {
    this.database = new Database(dbPath);
    this.database.pragma("foreign_keys = ON");
  }

  public async initialize(defaultModel: string): Promise<void> {
    this.database.pragma("journal_mode = WAL");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS provider_configs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        provider_type TEXT NOT NULL,
        provider_key TEXT NULL,
        model TEXT NOT NULL,
        base_url TEXT NULL,
        headers_encrypted TEXT NULL,
        api_key_encrypted TEXT NULL,
        temperature REAL NULL,
        is_active INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (provider_type IN ('ollama', 'openai', 'openai_compatible')),
        CHECK (is_active IN (0, 1))
      );

      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_configs_name
      ON provider_configs(name);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_configs_provider_key
      ON provider_configs(provider_key)
      WHERE provider_key IS NOT NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_configs_one_active
      ON provider_configs(is_active)
      WHERE is_active = 1;
    `);

    const existingVersion = this.database
      .prepare("SELECT value FROM app_meta WHERE key = 'provider_schema_version'")
      .get() as { value: string } | undefined;

    if (!existingVersion) {
      this.database
        .prepare("INSERT INTO app_meta (key, value) VALUES ('provider_schema_version', ?)")
        .run(String(PROVIDER_SCHEMA_VERSION));
    } else if (Number(existingVersion.value) !== PROVIDER_SCHEMA_VERSION) {
      throw new Error("Provider DB schema migration is required");
    }

    const countRow = this.database
      .prepare("SELECT COUNT(*) as count FROM provider_configs")
      .get() as { count: number };

    if (countRow.count === 0) {
      const timestamp = nowIso();
      this.database
        .prepare(
          `INSERT INTO provider_configs (
            id, name, provider_type, provider_key, model, base_url,
            headers_encrypted, api_key_encrypted, temperature,
            is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          crypto.randomUUID(),
          "default-ollama",
          "ollama",
          null,
          defaultModel,
          "http://127.0.0.1:11434",
          null,
          null,
          null,
          1,
          timestamp,
          timestamp
        );
    }
  }

  public async list(): Promise<StoredProviderRecord[]> {
    const rows = this.database
      .prepare(
        "SELECT * FROM provider_configs ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC"
      )
      .all() as ProviderConfigRow[];
    return rows.map(mapRecord);
  }

  public async get(providerId: string): Promise<StoredProviderRecord | null> {
    const row = this.database
      .prepare("SELECT * FROM provider_configs WHERE id = ?")
      .get(providerId) as ProviderConfigRow | undefined;

    return row ? mapRecord(row) : null;
  }

  public async create(input: StoredProviderWrite): Promise<StoredProviderRecord> {
    const providerId = crypto.randomUUID();
    const timestamp = nowIso();

    try {
      this.database
        .prepare(
          `INSERT INTO provider_configs (
            id, name, provider_type, provider_key, model, base_url,
            headers_encrypted, api_key_encrypted, temperature,
            is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          providerId,
          input.name,
          input.provider_type,
          input.provider_key ?? null,
          input.model,
          input.base_url ?? null,
          input.headers_encrypted ?? null,
          input.api_key_encrypted ?? null,
          input.temperature ?? null,
          input.is_active ? 1 : 0,
          timestamp,
          timestamp
        );
    } catch (error) {
      throw mapSqliteError(error, "Provider create violates database constraints");
    }

    return (await this.get(providerId))!;
  }

  public async update(providerId: string, patch: StoredProviderPatch): Promise<StoredProviderRecord> {
    const updates = Object.entries(patch).filter(([, value]) => value !== undefined);
    if (updates.length === 0) {
      const existing = await this.get(providerId);
      if (!existing) {
        throw new Error("Provider not found");
      }
      return existing;
    }

    const assignments = updates.map(([field]) => `${field} = ?`);
    const values = updates.map(([, value]) => value);
    assignments.push("updated_at = ?");
    values.push(nowIso());
    values.push(providerId);

    let result: Database.RunResult;
    try {
      result = this.database
        .prepare(`UPDATE provider_configs SET ${assignments.join(", ")} WHERE id = ?`)
        .run(...values);
    } catch (error) {
      throw mapSqliteError(error, "Provider update violates database constraints");
    }

    if (result.changes === 0) {
      throw new Error("Provider not found");
    }

    return (await this.get(providerId))!;
  }

  public async delete(providerId: string): Promise<boolean> {
    const result = this.database
      .prepare("DELETE FROM provider_configs WHERE id = ?")
      .run(providerId);
    return result.changes > 0;
  }

  public async setActive(providerId: string): Promise<StoredProviderRecord> {
    const transaction = this.database.transaction((targetId: string) => {
      const existing = this.database
        .prepare("SELECT id FROM provider_configs WHERE id = ?")
        .get(targetId) as { id: string } | undefined;

      if (!existing) {
        throw new Error("Provider not found");
      }

      const timestamp = nowIso();
      this.database.prepare("UPDATE provider_configs SET is_active = 0 WHERE is_active = 1").run();
      this.database
        .prepare(
          "UPDATE provider_configs SET is_active = 1, updated_at = ? WHERE id = ?"
        )
        .run(timestamp, targetId);
    });

    try {
      transaction(providerId);
    } catch (error) {
      throw mapSqliteError(error, "Provider activation violates database constraints");
    }

    return (await this.get(providerId))!;
  }

  public async getActive(): Promise<StoredProviderRecord | null> {
    const row = this.database
      .prepare("SELECT * FROM provider_configs WHERE is_active = 1")
      .get() as ProviderConfigRow | undefined;

    return row ? mapRecord(row) : null;
  }
}

function mapRecord(row: ProviderConfigRow): StoredProviderRecord {
  return {
    ...row,
    is_active: Boolean(row.is_active)
  };
}

function mapSqliteError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) {
    return new Error(fallbackMessage, { cause: error });
  }
  return new Error(fallbackMessage);
}

function nowIso(): string {
  return new Date().toISOString();
}
