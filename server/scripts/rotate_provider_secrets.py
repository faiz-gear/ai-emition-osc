from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from server.app.providers.crypto import ProviderCrypto
from server.app.providers.storage import SqliteProviderRepository


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Rotate encrypted provider secrets from old key to new key.",
    )
    parser.add_argument(
        "--db-path",
        default=os.environ.get("AI_EMOTION_PROVIDER_DB_PATH", "server/data/providers.db"),
        help="Path to providers SQLite database.",
    )
    parser.add_argument(
        "--old-key-env",
        default="AI_EMOTION_PROVIDER_SECRET_KEY_OLD",
        help="Environment variable containing the old secret key.",
    )
    parser.add_argument(
        "--new-key-env",
        default="AI_EMOTION_PROVIDER_SECRET_KEY_NEW",
        help="Environment variable containing the new secret key.",
    )
    return parser


async def rotate(db_path: str, old_key: str, new_key: str) -> int:
    repo = SqliteProviderRepository(db_path)
    await repo.initialize(default_model=os.environ.get("AI_EMOTION_LLM_MODEL", "qwen2.5:3b"))

    old_crypto = ProviderCrypto(old_key)
    new_crypto = ProviderCrypto(new_key)

    await repo.set_rotation_lock(True)
    try:
        records = await repo.list()
        updates: dict[str, tuple[str | None, str | None]] = {}
        for record in records:
            new_api = record.api_key_encrypted
            new_headers = record.headers_encrypted
            if record.api_key_encrypted:
                decrypted = old_crypto.decrypt_text(record.api_key_encrypted)
                new_api = new_crypto.encrypt_text(decrypted)
            if record.headers_encrypted:
                decrypted = old_crypto.decrypt_json(record.headers_encrypted)
                new_headers = new_crypto.encrypt_json(decrypted)
            if (
                new_api != record.api_key_encrypted
                or new_headers != record.headers_encrypted
            ):
                updates[record.id] = (new_api, new_headers)
        await repo.bulk_update_encrypted_fields(updates)
    finally:
        await repo.set_rotation_lock(False)
    return 0


def main() -> int:
    args = build_parser().parse_args()
    old_key = os.environ.get(args.old_key_env, "").strip()
    new_key = os.environ.get(args.new_key_env, "").strip()
    if old_key == "":
        print(f"Missing old key env: {args.old_key_env}", file=sys.stderr)
        return 2
    if new_key == "":
        print(f"Missing new key env: {args.new_key_env}", file=sys.stderr)
        return 2

    try:
        return asyncio.run(rotate(args.db_path, old_key, new_key))
    except Exception as exc:
        print(f"Secret rotation failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
