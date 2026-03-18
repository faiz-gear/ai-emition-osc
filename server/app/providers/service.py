from __future__ import annotations

import asyncio
import time
from typing import Any

from langchain_core.language_models.chat_models import BaseChatModel

from .base import (
    CreateProviderInput,
    ProviderRuntimeConfig,
    ProviderSummary,
    ProviderTestResult,
    StoredProviderPatch,
    StoredProviderRecord,
    StoredProviderWrite,
    UpdateProviderInput,
)
from .crypto import ProviderCrypto
from .errors import (
    ProviderAuthFailedError,
    ProviderActiveNotSetError,
    ProviderActivationConflictError,
    ProviderConflictError,
    ProviderNotFoundError,
    ProviderRateLimitedError,
    ProviderRotationInProgressError,
    ProviderSecretDecryptError,
    ProviderTypeImmutableError,
    ProviderUpstreamUnavailableError,
    ProviderValidationError,
)
from .registry import ProviderRegistry
from .storage import SqliteProviderRepository


class ProviderService:
    def __init__(
        self,
        repository: SqliteProviderRepository,
        registry: ProviderRegistry,
        crypto: ProviderCrypto,
    ):
        self._repo = repository
        self._registry = registry
        self._crypto = crypto
        self._activate_lock: asyncio.Lock | None = None

    async def list_summaries(self) -> list[ProviderSummary]:
        records = await self._repo.list()
        summaries: list[ProviderSummary] = []
        for record in records:
            try:
                api_key, headers = self._decrypt_secrets(record)
                summaries.append(self._summary_from_plain(record, api_key, headers))
            except ProviderSecretDecryptError as exc:
                summaries.append(
                    ProviderSummary(
                        id=record.id,
                        name=record.name,
                        provider_type=record.provider_type,
                        provider_key=record.provider_key,
                        model=record.model,
                        base_url=record.base_url,
                        temperature=record.temperature,
                        is_active=record.is_active,
                        updated_at=record.updated_at,
                        has_api_key=None,
                        headers_keys=None,
                        status="degraded",
                        error_code=exc.code,
                        error_message=exc.user_message,
                    )
                )
        return summaries

    async def create_provider(self, input: CreateProviderInput) -> ProviderSummary:
        await self._ensure_mutation_allowed()
        normalized = self._normalize_and_validate_input(input)
        try:
            record = await self._repo.create(
                StoredProviderWrite(
                    name=normalized.name,
                    provider_type=normalized.provider_type,
                    provider_key=normalized.provider_key,
                    model=normalized.model,
                    base_url=normalized.base_url,
                    headers_encrypted=(
                        self._crypto.encrypt_json(normalized.headers)
                        if normalized.headers
                        else None
                    ),
                    api_key_encrypted=(
                        self._crypto.encrypt_text(normalized.api_key)
                        if normalized.api_key
                        else None
                    ),
                    temperature=normalized.temperature,
                    is_active=False,
                )
            )
        except ValueError as exc:
            raise ProviderConflictError() from exc
        return self._summary_from_plain(record, normalized.api_key, normalized.headers)

    async def update_provider(
        self, provider_id: str, patch: UpdateProviderInput
    ) -> ProviderSummary:
        await self._ensure_mutation_allowed()
        if "provider_type" in patch:
            raise ProviderTypeImmutableError()

        existing = await self._repo.get(provider_id)
        if existing is None:
            raise ProviderNotFoundError()

        current_api_key, current_headers = self._decrypt_secrets(existing)
        if "name" in patch and patch.get("name") is None:
            raise ProviderValidationError("name cannot be null")
        if "model" in patch and patch.get("model") is None:
            raise ProviderValidationError("model cannot be null")

        effective = CreateProviderInput(
            name=patch["name"] if "name" in patch else existing.name,
            provider_type=existing.provider_type,
            provider_key=(
                patch["provider_key"]
                if "provider_key" in patch
                else existing.provider_key
            ),
            model=patch["model"] if "model" in patch else existing.model,
            base_url=patch.get("base_url", existing.base_url),
            temperature=patch.get("temperature", existing.temperature),
            api_key=patch.get("api_key", current_api_key),
            headers=patch.get("headers", current_headers),
        )
        normalized = self._normalize_and_validate_input(effective)

        update_patch: StoredProviderPatch = {}
        for field in ("name", "provider_key", "model", "base_url", "temperature"):
            if field in patch:
                update_patch[field] = getattr(normalized, field)

        if "api_key" in patch:
            update_patch["api_key_encrypted"] = (
                self._crypto.encrypt_text(normalized.api_key)
                if normalized.api_key
                else None
            )
        if "headers" in patch:
            update_patch["headers_encrypted"] = (
                self._crypto.encrypt_json(normalized.headers)
                if normalized.headers
                else None
            )

        try:
            updated = await self._repo.update(provider_id, update_patch)
        except KeyError as exc:
            raise ProviderNotFoundError() from exc
        except ValueError as exc:
            raise ProviderConflictError() from exc
        return self._summary_from_plain(updated, normalized.api_key, normalized.headers)

    async def delete_provider(self, provider_id: str) -> None:
        await self._ensure_mutation_allowed()
        deleted = await self._repo.delete(provider_id)
        if not deleted:
            raise ProviderNotFoundError()

    async def activate_provider(self, provider_id: str) -> ProviderSummary:
        await self._ensure_mutation_allowed()
        runtime = await self.get_runtime_config(provider_id)
        adapter = self._registry.get(runtime.provider_type)
        adapter.validate(runtime)

        async with self._get_activate_lock():
            try:
                updated = await self._repo.set_active(provider_id)
            except KeyError as exc:
                raise ProviderNotFoundError() from exc
            except ValueError as exc:
                raise ProviderActivationConflictError() from exc
        return self._summary_from_plain(updated, runtime.api_key, runtime.headers)

    async def test_provider(self, provider_id: str) -> ProviderTestResult:
        await self._ensure_mutation_allowed()
        started = time.perf_counter()
        runtime = await self.get_runtime_config(provider_id)
        adapter = self._registry.get(runtime.provider_type)
        adapter.validate(runtime)
        model = adapter.create_model(runtime)
        try:
            await model.ainvoke(
                "Respond with a short JSON object: {\"ok\": true}"
            )
        except Exception as exc:
            status_code = getattr(exc, "status_code", None)
            message = str(exc).lower()
            if status_code in {401, 403} or "unauthorized" in message or "forbidden" in message:
                raise ProviderAuthFailedError() from exc
            if status_code == 429 or "rate limit" in message or "too many requests" in message:
                raise ProviderRateLimitedError() from exc
            raise ProviderUpstreamUnavailableError(str(exc)) from exc
        latency = (time.perf_counter() - started) * 1000.0
        return ProviderTestResult(ok=True, latency_ms=latency)

    async def get_active_summary(self) -> ProviderSummary:
        active = await self._repo.get_active()
        if active is None:
            raise ProviderActiveNotSetError()
        api_key, headers = self._decrypt_secrets(active)
        return self._summary_from_plain(active, api_key, headers)

    async def get_active_chat_model(self) -> BaseChatModel:
        active = await self._repo.get_active()
        if active is None:
            raise ProviderActiveNotSetError()
        runtime = self._runtime_from_record(active)
        adapter = self._registry.get(runtime.provider_type)
        adapter.validate(runtime)
        return adapter.create_model(runtime)

    async def get_runtime_config(self, provider_id: str) -> ProviderRuntimeConfig:
        record = await self._repo.get(provider_id)
        if record is None:
            raise ProviderNotFoundError()
        return self._runtime_from_record(record)

    def _runtime_from_record(self, record: StoredProviderRecord) -> ProviderRuntimeConfig:
        api_key, headers = self._decrypt_secrets(record)
        return ProviderRuntimeConfig(
            id=record.id,
            name=record.name,
            provider_type=record.provider_type,
            provider_key=record.provider_key,
            model=record.model,
            base_url=record.base_url,
            headers=headers,
            api_key=api_key,
            temperature=record.temperature,
            is_active=record.is_active,
        )

    def _decrypt_secrets(
        self, record: StoredProviderRecord
    ) -> tuple[str | None, dict[str, str] | None]:
        try:
            api_key = (
                self._crypto.decrypt_text(record.api_key_encrypted)
                if record.api_key_encrypted
                else None
            )
            headers_raw = (
                self._crypto.decrypt_json(record.headers_encrypted)
                if record.headers_encrypted
                else None
            )
            if headers_raw is None:
                headers = None
            else:
                headers = {str(k): str(v) for k, v in headers_raw.items()}
        except ValueError as exc:
            raise ProviderSecretDecryptError() from exc
        return api_key, headers

    def _summary_from_plain(
        self,
        record: StoredProviderRecord,
        api_key: str | None,
        headers: dict[str, str] | None,
    ) -> ProviderSummary:
        header_keys = sorted(list(headers.keys())) if headers else []
        return ProviderSummary(
            id=record.id,
            name=record.name,
            provider_type=record.provider_type,
            provider_key=record.provider_key,
            model=record.model,
            base_url=record.base_url,
            temperature=record.temperature,
            is_active=record.is_active,
            updated_at=record.updated_at,
            has_api_key=bool(api_key),
            headers_keys=header_keys,
            status="ok",
        )

    async def _ensure_mutation_allowed(self) -> None:
        checker = getattr(self._repo, "is_rotation_locked", None)
        if checker is not None and callable(checker):
            if await checker():
                raise ProviderRotationInProgressError()

    def _get_activate_lock(self) -> asyncio.Lock:
        if self._activate_lock is None:
            self._activate_lock = asyncio.Lock()
        return self._activate_lock

    def _normalize_and_validate_input(
        self, input: CreateProviderInput
    ) -> CreateProviderInput:
        if input.name.strip() == "":
            raise ProviderValidationError("name is required")
        if input.model.strip() == "":
            raise ProviderValidationError("model is required")
        if input.temperature is not None and not (0.0 <= input.temperature <= 2.0):
            raise ProviderValidationError("temperature must be between 0 and 2")

        provider_type = input.provider_type
        provider_key = input.provider_key
        api_key = input.api_key
        base_url = input.base_url
        headers = input.headers

        if provider_type == "ollama":
            provider_key = None
            api_key = None
            headers = None
        elif provider_type == "openai":
            provider_key = None
            if api_key is None or api_key.strip() == "":
                raise ProviderValidationError("openai provider requires api_key")
        elif provider_type == "openai_compatible":
            if provider_key is None or provider_key.strip() == "":
                raise ProviderValidationError(
                    "openai_compatible provider requires provider_key"
                )
            if base_url is None or base_url.strip() == "":
                raise ProviderValidationError(
                    "openai_compatible provider requires base_url"
                )
        else:
            raise ProviderValidationError("unsupported provider_type")

        return CreateProviderInput(
            name=input.name.strip(),
            provider_type=provider_type,
            provider_key=provider_key,
            model=input.model.strip(),
            base_url=base_url.strip() if isinstance(base_url, str) else base_url,
            temperature=input.temperature,
            api_key=api_key,
            headers=headers,
        )
