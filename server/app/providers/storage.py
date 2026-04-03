from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncIterator

import aiosqlite

from .base import StoredProviderPatch, StoredProviderRecord, StoredProviderWrite


PROVIDER_SCHEMA_VERSION = 1


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value)


def _coerce_record(row: aiosqlite.Row) -> StoredProviderRecord:
    return StoredProviderRecord(
        id=str(row["id"]),
        name=str(row["name"]),
        provider_type=str(row["provider_type"]),  # type: ignore[arg-type]
        provider_key=row["provider_key"],
        model=str(row["model"]),
        base_url=row["base_url"],
        headers_encrypted=row["headers_encrypted"],
        api_key_encrypted=row["api_key_encrypted"],
        temperature=row["temperature"],
        is_active=bool(row["is_active"]),
        created_at=_parse_iso(str(row["created_at"])),
        updated_at=_parse_iso(str(row["updated_at"])),
    )


class SqliteProviderRepository:
    def __init__(self, db_path: str | Path):
        self._db_path = Path(db_path)

    @asynccontextmanager
    async def _connect(self) -> AsyncIterator[aiosqlite.Connection]:
        db = await aiosqlite.connect(self._db_path)
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA foreign_keys=ON;")
        try:
            yield db
        finally:
            await db.close()

    async def initialize(self, default_model: str) -> None:
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        async with self._connect() as db:
            await db.execute("PRAGMA journal_mode=WAL;")
            await db.execute(
                """
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
                    CHECK (provider_type IN ('ollama','openai','openai_compatible')),
                    CHECK (is_active IN (0,1))
                )
                """
            )
            await db.execute(
                """
                CREATE TABLE IF NOT EXISTS app_meta (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
                """
            )
            await db.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_configs_name
                ON provider_configs(name)
                """
            )
            await db.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_configs_provider_key
                ON provider_configs(provider_key)
                WHERE provider_key IS NOT NULL
                """
            )
            await db.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_configs_one_active
                ON provider_configs(is_active)
                WHERE is_active = 1
                """
            )

            row = await (
                await db.execute(
                    "SELECT value FROM app_meta WHERE key = 'provider_schema_version'"
                )
            ).fetchone()
            if row is None:
                await db.execute(
                    "INSERT INTO app_meta (key, value) VALUES (?, ?)",
                    ("provider_schema_version", str(PROVIDER_SCHEMA_VERSION)),
                )
            else:
                version = int(row["value"])
                if version > PROVIDER_SCHEMA_VERSION:
                    raise RuntimeError("Provider DB schema is newer than application")
                if version < PROVIDER_SCHEMA_VERSION:
                    raise RuntimeError("Provider DB schema migration is required")

            count_row = await (
                await db.execute("SELECT COUNT(*) AS count FROM provider_configs")
            ).fetchone()
            if count_row and int(count_row["count"]) == 0:
                now = _now_iso()
                await db.execute(
                    """
                    INSERT INTO provider_configs (
                        id, name, provider_type, provider_key, model, base_url,
                        headers_encrypted, api_key_encrypted, temperature,
                        is_active, created_at, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        str(uuid.uuid4()),
                        "default-ollama",
                        "ollama",
                        None,
                        default_model,
                        "http://127.0.0.1:11434",
                        None,
                        None,
                        None,
                        1,
                        now,
                        now,
                    ),
                )
            await db.execute(
                """
                INSERT INTO app_meta (key, value) VALUES ('provider_rotation_lock', '0')
                ON CONFLICT(key) DO NOTHING
                """
            )
            await db.commit()

    async def list(self) -> list[StoredProviderRecord]:
        async with self._connect() as db:
            rows = await (
                await db.execute(
                    "SELECT * FROM provider_configs ORDER BY updated_at DESC, created_at DESC"
                )
            ).fetchall()
        return [_coerce_record(row) for row in rows]

    async def get(self, provider_id: str) -> StoredProviderRecord | None:
        async with self._connect() as db:
            row = await (
                await db.execute(
                    "SELECT * FROM provider_configs WHERE id = ?",
                    (provider_id,),
                )
            ).fetchone()
        if row is None:
            return None
        return _coerce_record(row)

    async def create(self, input: StoredProviderWrite) -> StoredProviderRecord:
        provider_id = str(uuid.uuid4())
        now = _now_iso()
        try:
            async with self._connect() as db:
                await db.execute(
                    """
                    INSERT INTO provider_configs (
                        id, name, provider_type, provider_key, model, base_url,
                        headers_encrypted, api_key_encrypted, temperature,
                        is_active, created_at, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        provider_id,
                        input.name,
                        input.provider_type,
                        input.provider_key,
                        input.model,
                        input.base_url,
                        input.headers_encrypted,
                        input.api_key_encrypted,
                        input.temperature,
                        1 if input.is_active else 0,
                        now,
                        now,
                    ),
                )
                await db.commit()
                row = await (
                    await db.execute(
                        "SELECT * FROM provider_configs WHERE id = ?",
                        (provider_id,),
                    )
                ).fetchone()
        except aiosqlite.IntegrityError as exc:
            raise ValueError("Provider create violates database constraints") from exc
        if row is None:
            raise RuntimeError("Failed to load created provider")
        return _coerce_record(row)

    async def update(
        self, provider_id: str, patch: StoredProviderPatch
    ) -> StoredProviderRecord:
        allowed_fields = {
            "name",
            "provider_key",
            "model",
            "base_url",
            "headers_encrypted",
            "api_key_encrypted",
            "temperature",
            "is_active",
        }
        updates: list[str] = []
        values: list[object] = []
        for key, value in patch.items():
            if key not in allowed_fields:
                continue
            if key == "is_active":
                values.append(1 if bool(value) else 0)
            else:
                values.append(value)
            updates.append(f"{key} = ?")

        if not updates:
            existing = await self.get(provider_id)
            if existing is None:
                raise KeyError(provider_id)
            return existing

        updates.append("updated_at = ?")
        values.append(_now_iso())
        values.append(provider_id)

        try:
            async with self._connect() as db:
                cursor = await db.execute(
                    f"UPDATE provider_configs SET {', '.join(updates)} WHERE id = ?",
                    values,
                )
                if cursor.rowcount == 0:
                    raise KeyError(provider_id)
                await db.commit()
                row = await (
                    await db.execute(
                        "SELECT * FROM provider_configs WHERE id = ?",
                        (provider_id,),
                    )
                ).fetchone()
        except aiosqlite.IntegrityError as exc:
            raise ValueError("Provider update violates database constraints") from exc
        if row is None:
            raise RuntimeError("Failed to load updated provider")
        return _coerce_record(row)

    async def delete(self, provider_id: str) -> bool:
        async with self._connect() as db:
            cursor = await db.execute(
                "DELETE FROM provider_configs WHERE id = ?",
                (provider_id,),
            )
            await db.commit()
        return cursor.rowcount > 0

    async def set_active(self, provider_id: str) -> StoredProviderRecord:
        try:
            async with self._connect() as db:
                await db.execute("BEGIN")
                row = await (
                    await db.execute(
                        "SELECT id FROM provider_configs WHERE id = ?",
                        (provider_id,),
                    )
                ).fetchone()
                if row is None:
                    await db.rollback()
                    raise KeyError(provider_id)

                now = _now_iso()
                await db.execute(
                    """
                    UPDATE provider_configs
                    SET is_active = 0, updated_at = ?
                    WHERE is_active = 1 AND id <> ?
                    """,
                    (now, provider_id),
                )
                await db.execute(
                    """
                    UPDATE provider_configs
                    SET is_active = 1, updated_at = ?
                    WHERE id = ?
                    """,
                    (now, provider_id),
                )
                await db.commit()
                result = await (
                    await db.execute(
                        "SELECT * FROM provider_configs WHERE id = ?",
                        (provider_id,),
                    )
                ).fetchone()
        except aiosqlite.IntegrityError as exc:
            raise ValueError("Provider activation conflict") from exc

        if result is None:
            raise RuntimeError("Failed to load active provider")
        return _coerce_record(result)

    async def get_active(self) -> StoredProviderRecord | None:
        async with self._connect() as db:
            row = await (
                await db.execute(
                    "SELECT * FROM provider_configs WHERE is_active = 1 LIMIT 1"
                )
            ).fetchone()
        if row is None:
            return None
        return _coerce_record(row)

    async def is_rotation_locked(self) -> bool:
        async with self._connect() as db:
            row = await (
                await db.execute(
                    "SELECT value FROM app_meta WHERE key = 'provider_rotation_lock'"
                )
            ).fetchone()
        if row is None:
            return False
        return str(row["value"]) == "1"

    async def set_rotation_lock(self, enabled: bool) -> None:
        async with self._connect() as db:
            await db.execute(
                """
                INSERT INTO app_meta (key, value) VALUES ('provider_rotation_lock', ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
                """,
                ("1" if enabled else "0",),
            )
            await db.commit()

    async def bulk_update_encrypted_fields(
        self, updates: dict[str, tuple[str | None, str | None]]
    ) -> None:
        if not updates:
            return
        now = _now_iso()
        async with self._connect() as db:
            await db.execute("BEGIN")
            try:
                for provider_id, (api_key_encrypted, headers_encrypted) in updates.items():
                    cursor = await db.execute(
                        """
                        UPDATE provider_configs
                        SET api_key_encrypted = ?, headers_encrypted = ?, updated_at = ?
                        WHERE id = ?
                        """,
                        (api_key_encrypted, headers_encrypted, now, provider_id),
                    )
                    if cursor.rowcount == 0:
                        raise ValueError(f"Provider not found during bulk update: {provider_id}")
                await db.commit()
            except Exception:
                await db.rollback()
                raise
