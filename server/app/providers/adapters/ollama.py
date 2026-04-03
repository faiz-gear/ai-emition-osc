from __future__ import annotations

from langchain_ollama import ChatOllama

from ..base import ProviderRuntimeConfig, ProviderType


class OllamaAdapter:
    provider_type: ProviderType = "ollama"

    def validate(self, config: ProviderRuntimeConfig) -> None:
        if config.model.strip() == "":
            raise ValueError("ollama provider requires model")

    def create_model(self, config: ProviderRuntimeConfig) -> ChatOllama:
        self.validate(config)
        base_url = config.base_url or "http://127.0.0.1:11434"
        if config.temperature is None:
            return ChatOllama(model=config.model, base_url=base_url)
        return ChatOllama(
            model=config.model,
            base_url=base_url,
            temperature=config.temperature,
        )
