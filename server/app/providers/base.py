from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal, Protocol, TypedDict


ProviderType = Literal["ollama", "openai", "openai_compatible"]


@dataclass(frozen=True)
class StoredProviderRecord:
    id: str
    name: str
    provider_type: ProviderType
    provider_key: str | None
    model: str
    base_url: str | None
    headers_encrypted: str | None
    api_key_encrypted: str | None
    temperature: float | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class StoredProviderWrite:
    name: str
    provider_type: ProviderType
    provider_key: str | None
    model: str
    base_url: str | None
    headers_encrypted: str | None
    api_key_encrypted: str | None
    temperature: float | None
    is_active: bool = False


class StoredProviderPatch(TypedDict, total=False):
    name: str
    provider_key: str | None
    model: str
    base_url: str | None
    headers_encrypted: str | None
    api_key_encrypted: str | None
    temperature: float | None
    is_active: bool


class ProviderRepository(Protocol):
    async def list(self) -> list[StoredProviderRecord]: ...

    async def get(self, provider_id: str) -> StoredProviderRecord | None: ...

    async def create(self, input: StoredProviderWrite) -> StoredProviderRecord: ...

    async def update(
        self, provider_id: str, patch: StoredProviderPatch
    ) -> StoredProviderRecord: ...

    async def delete(self, provider_id: str) -> bool: ...

    async def set_active(self, provider_id: str) -> StoredProviderRecord: ...

    async def get_active(self) -> StoredProviderRecord | None: ...
