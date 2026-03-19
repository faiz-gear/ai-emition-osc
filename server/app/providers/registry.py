from __future__ import annotations

from dataclasses import dataclass

from .adapters import OllamaAdapter, OpenAIAdapter, OpenAICompatibleAdapter
from .base import ProviderAdapter, ProviderType


@dataclass(frozen=True)
class ProviderRegistry:
    _adapters: dict[ProviderType, ProviderAdapter]

    @classmethod
    def default(cls) -> "ProviderRegistry":
        adapters: dict[ProviderType, ProviderAdapter] = {
            "ollama": OllamaAdapter(),
            "openai": OpenAIAdapter(),
            "openai_compatible": OpenAICompatibleAdapter(),
        }
        return cls(_adapters=adapters)

    def get(self, provider_type: ProviderType) -> ProviderAdapter:
        adapter = self._adapters.get(provider_type)
        if adapter is None:
            raise KeyError(f"Unsupported provider type: {provider_type}")
        return adapter
