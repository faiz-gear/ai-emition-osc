import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ENVELOPE_VERSION = 1;
const ENVELOPE_ALGORITHM = "AES-256-GCM";
const NONCE_SIZE = 12;
const TAG_SIZE = 16;

type EncryptedEnvelope = {
  v: number;
  alg: string;
  kid: string;
  nonce_b64: string;
  ciphertext_b64: string;
  tag_b64: string;
};

export class ProviderCrypto {
  public constructor(
    private readonly secretKey: string,
    private readonly kid = "default"
  ) {}

  public encryptText(value: string): string {
    const nonce = randomBytes(NONCE_SIZE);
    const cipher = createCipheriv("aes-256-gcm", deriveKey(this.secretKey), nonce);
    const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    const payload: EncryptedEnvelope = {
      v: ENVELOPE_VERSION,
      alg: ENVELOPE_ALGORITHM,
      kid: this.kid,
      nonce_b64: nonce.toString("base64"),
      ciphertext_b64: ciphertext.toString("base64"),
      tag_b64: tag.toString("base64")
    };

    return JSON.stringify(payload);
  }

  public decryptText(payload: string): string {
    const envelope = parseEnvelope(payload);
    const decipher = createDecipheriv(
      "aes-256-gcm",
      deriveKey(this.secretKey),
      Buffer.from(envelope.nonce_b64, "base64")
    );
    decipher.setAuthTag(Buffer.from(envelope.tag_b64, "base64"));

    try {
      const plain = Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertext_b64, "base64")),
        decipher.final()
      ]);
      return plain.toString("utf8");
    } catch (error) {
      throw new Error("Failed to decrypt provider secret", { cause: error });
    }
  }

  public encryptJson(value: Record<string, string>): string {
    return this.encryptText(JSON.stringify(value));
  }

  public decryptJson(payload: string): Record<string, string> {
    let parsed: unknown;

    try {
      parsed = JSON.parse(this.decryptText(payload));
    } catch (error) {
      throw new Error("Decrypted payload is not valid JSON", { cause: error });
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Decrypted JSON payload must be an object");
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string"
      )
    );
  }
}

function deriveKey(secretKey: string): Buffer {
  const normalized = secretKey.trim();
  if (normalized === "") {
    throw new Error("Provider secret key must not be empty");
  }

  return createHash("sha256").update(normalized, "utf8").digest();
}

function parseEnvelope(payload: string): EncryptedEnvelope {
  let parsed: unknown;

  try {
    parsed = JSON.parse(payload);
  } catch (error) {
    throw new Error("Invalid encrypted payload format", { cause: error });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Encrypted payload must be an object");
  }

  const envelope = parsed as Partial<EncryptedEnvelope>;
  if (envelope.v !== ENVELOPE_VERSION) {
    throw new Error("Unsupported encrypted payload version");
  }
  if (envelope.alg !== ENVELOPE_ALGORITHM) {
    throw new Error("Unsupported encrypted payload algorithm");
  }
  if (
    typeof envelope.kid !== "string" ||
    typeof envelope.nonce_b64 !== "string" ||
    typeof envelope.ciphertext_b64 !== "string" ||
    typeof envelope.tag_b64 !== "string"
  ) {
    throw new Error("Encrypted payload missing required field");
  }

  const nonce = Buffer.from(envelope.nonce_b64, "base64");
  const tag = Buffer.from(envelope.tag_b64, "base64");
  if (nonce.byteLength !== NONCE_SIZE || tag.byteLength !== TAG_SIZE) {
    throw new Error("Invalid encrypted payload format");
  }

  return envelope as EncryptedEnvelope;
}
