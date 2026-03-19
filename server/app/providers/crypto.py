from __future__ import annotations

import base64
import hashlib
import json
import os
from dataclasses import dataclass
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


_ENVELOPE_VERSION = 1
_ENVELOPE_ALG = "AES-256-GCM"
_NONCE_SIZE = 12
_TAG_SIZE = 16


def _b64encode(value: bytes) -> str:
    return base64.b64encode(value).decode("ascii")


def _b64decode(value: str) -> bytes:
    return base64.b64decode(value.encode("ascii"))


def _derive_key(secret_key: str) -> bytes:
    normalized = secret_key.strip()
    if normalized == "":
        raise ValueError("Provider secret key must not be empty")
    return hashlib.sha256(normalized.encode("utf-8")).digest()


@dataclass(frozen=True)
class ProviderCrypto:
    secret_key: str
    kid: str = "default"

    def encrypt_text(self, value: str) -> str:
        nonce = os.urandom(_NONCE_SIZE)
        aes = AESGCM(_derive_key(self.secret_key))
        encrypted = aes.encrypt(nonce, value.encode("utf-8"), None)
        payload = {
            "v": _ENVELOPE_VERSION,
            "alg": _ENVELOPE_ALG,
            "kid": self.kid,
            "nonce_b64": _b64encode(nonce),
            "ciphertext_b64": _b64encode(encrypted[:-_TAG_SIZE]),
            "tag_b64": _b64encode(encrypted[-_TAG_SIZE:]),
        }
        return json.dumps(payload, separators=(",", ":"))

    def decrypt_text(self, payload: str) -> str:
        try:
            envelope = json.loads(payload)
            if not isinstance(envelope, dict):
                raise ValueError("Encrypted payload must be an object")

            if envelope.get("v") != _ENVELOPE_VERSION:
                raise ValueError("Unsupported encrypted payload version")
            if envelope.get("alg") != _ENVELOPE_ALG:
                raise ValueError("Unsupported encrypted payload algorithm")

            nonce = _b64decode(str(envelope["nonce_b64"]))
            ciphertext = _b64decode(str(envelope["ciphertext_b64"]))
            tag = _b64decode(str(envelope["tag_b64"]))
            if len(nonce) != _NONCE_SIZE:
                raise ValueError("Invalid nonce size")
            if len(tag) != _TAG_SIZE:
                raise ValueError("Invalid tag size")
        except KeyError as exc:
            raise ValueError("Encrypted payload missing required field") from exc
        except (TypeError, ValueError, json.JSONDecodeError) as exc:
            raise ValueError("Invalid encrypted payload format") from exc

        aes = AESGCM(_derive_key(self.secret_key))
        try:
            plain = aes.decrypt(nonce, ciphertext + tag, None)
        except Exception as exc:  # cryptography raises InvalidTag
            raise ValueError("Failed to decrypt provider secret") from exc
        return plain.decode("utf-8")

    def encrypt_json(self, value: dict[str, Any]) -> str:
        return self.encrypt_text(
            json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        )

    def decrypt_json(self, payload: str) -> dict[str, Any]:
        raw = self.decrypt_text(payload)
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError("Decrypted payload is not valid JSON") from exc
        if not isinstance(data, dict):
            raise ValueError("Decrypted JSON payload must be an object")
        return data
