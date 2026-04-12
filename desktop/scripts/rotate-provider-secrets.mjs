import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import process from "node:process";
import Database from "better-sqlite3";

const ENVELOPE_VERSION = 1;
const ENVELOPE_ALGORITHM = "AES-256-GCM";
const NONCE_SIZE = 12;
const TAG_SIZE = 16;

function printHelp() {
  console.log(`Usage: npm run provider:rotate-secrets -- --db-path <path> [--old-key-env NAME] [--new-key-env NAME]

Rotates encrypted provider secrets in place using an old/new environment key pair.

Options:
  --db-path <path>       Path to the providers.sqlite3 file
  --old-key-env <name>   Environment variable containing the current key
                         Default: AI_EMOTION_PROVIDER_SECRET_KEY_OLD
  --new-key-env <name>   Environment variable containing the replacement key
                         Default: AI_EMOTION_PROVIDER_SECRET_KEY_NEW
  --help                 Show this help text
`);
}

function parseArgs(argv) {
  const options = {
    dbPath: null,
    oldKeyEnv: "AI_EMOTION_PROVIDER_SECRET_KEY_OLD",
    newKeyEnv: "AI_EMOTION_PROVIDER_SECRET_KEY_NEW"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--help") {
      printHelp();
      process.exit(0);
    }

    if (argument === "--db-path") {
      options.dbPath = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (argument === "--old-key-env") {
      options.oldKeyEnv = argv[index + 1] ?? options.oldKeyEnv;
      index += 1;
      continue;
    }

    if (argument === "--new-key-env") {
      options.newKeyEnv = argv[index + 1] ?? options.newKeyEnv;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  if (!options.dbPath) {
    throw new Error("Missing required argument: --db-path");
  }

  return options;
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function deriveKey(secretKey) {
  const normalized = secretKey.trim();
  if (normalized === "") {
    throw new Error("Provider secret key must not be empty");
  }

  return createHash("sha256").update(normalized, "utf8").digest();
}

function parseEnvelope(payload) {
  let parsed;

  try {
    parsed = JSON.parse(payload);
  } catch (error) {
    throw new Error("Invalid encrypted payload format", { cause: error });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Encrypted payload must be an object");
  }

  if (parsed.v !== ENVELOPE_VERSION) {
    throw new Error("Unsupported encrypted payload version");
  }

  if (parsed.alg !== ENVELOPE_ALGORITHM) {
    throw new Error("Unsupported encrypted payload algorithm");
  }

  if (
    typeof parsed.nonce_b64 !== "string" ||
    typeof parsed.ciphertext_b64 !== "string" ||
    typeof parsed.tag_b64 !== "string"
  ) {
    throw new Error("Encrypted payload missing required field");
  }

  const nonce = Buffer.from(parsed.nonce_b64, "base64");
  const tag = Buffer.from(parsed.tag_b64, "base64");

  if (nonce.byteLength !== NONCE_SIZE || tag.byteLength !== TAG_SIZE) {
    throw new Error("Invalid encrypted payload format");
  }

  return parsed;
}

function decryptText(secretKey, payload) {
  const envelope = parseEnvelope(payload);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveKey(secretKey),
    Buffer.from(envelope.nonce_b64, "base64")
  );

  decipher.setAuthTag(Buffer.from(envelope.tag_b64, "base64"));

  try {
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext_b64, "base64")),
      decipher.final()
    ]);

    return plaintext.toString("utf8");
  } catch (error) {
    throw new Error("Failed to decrypt provider secret", { cause: error });
  }
}

function decryptJson(secretKey, payload) {
  const decrypted = JSON.parse(decryptText(secretKey, payload));
  if (!decrypted || typeof decrypted !== "object" || Array.isArray(decrypted)) {
    throw new Error("Decrypted JSON payload must be an object");
  }

  return Object.fromEntries(
    Object.entries(decrypted).filter(
      ([key, value]) => typeof key === "string" && typeof value === "string"
    )
  );
}

function encryptText(secretKey, value) {
  const nonce = randomBytes(NONCE_SIZE);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secretKey), nonce);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    v: ENVELOPE_VERSION,
    alg: ENVELOPE_ALGORITHM,
    kid: "default",
    nonce_b64: nonce.toString("base64"),
    ciphertext_b64: ciphertext.toString("base64"),
    tag_b64: tag.toString("base64")
  });
}

function encryptJson(secretKey, value) {
  return encryptText(secretKey, JSON.stringify(value));
}

function ensureProviderSchema(db) {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'provider_configs'")
    .get();

  if (!row) {
    throw new Error("Provider DB schema is not initialized");
  }
}

function ensureAppMetaTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

function isRotationLocked(db) {
  ensureAppMetaTable(db);
  const row = db.prepare("SELECT value FROM app_meta WHERE key = ?").get("provider_rotation_lock");
  return row?.value === "1";
}

function setRotationLock(db, locked) {
  ensureAppMetaTable(db);
  db.prepare(
    `INSERT INTO app_meta (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run("provider_rotation_lock", locked ? "1" : "0");
}

function rotateSecrets({ dbPath, oldKey, newKey }) {
  const db = new Database(dbPath);

  try {
    ensureProviderSchema(db);

    if (isRotationLocked(db)) {
      throw new Error("Provider secret rotation is already in progress");
    }

    setRotationLock(db, true);

    try {
      const rotate = db.transaction(() => {
        const rows = db
          .prepare(
            `SELECT id, api_key_encrypted, headers_encrypted
             FROM provider_configs
             ORDER BY datetime(created_at) ASC`
          )
          .all();
        const update = db.prepare(
          `UPDATE provider_configs
           SET api_key_encrypted = ?, headers_encrypted = ?, updated_at = ?
           WHERE id = ?`
        );
        let rotatedProviders = 0;

        for (const row of rows) {
          const nextApiKey = row.api_key_encrypted
            ? encryptText(newKey, decryptText(oldKey, row.api_key_encrypted))
            : null;
          const nextHeaders = row.headers_encrypted
            ? encryptJson(newKey, decryptJson(oldKey, row.headers_encrypted))
            : null;

          update.run(nextApiKey, nextHeaders, new Date().toISOString(), row.id);
          rotatedProviders += 1;
        }

        return rotatedProviders;
      });

      return rotate();
    } finally {
      setRotationLock(db, false);
    }
  } finally {
    db.close();
  }
}

try {
  const options = parseArgs(process.argv.slice(2));
  const oldKey = requireEnv(options.oldKeyEnv);
  const newKey = requireEnv(options.newKeyEnv);

  if (oldKey === newKey) {
    throw new Error("Old and new provider secret keys must differ");
  }

  const rotatedProviders = rotateSecrets({
    dbPath: options.dbPath,
    oldKey,
    newKey
  });

  console.log(`Rotated provider secrets for ${rotatedProviders} provider record(s).`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
