from __future__ import annotations

from langchain_ollama import ChatOllama

from ..base import ProviderRuntimeConfig


class OllamaAdapter:
    provider_type = "ollama"

    def validate(self, config: ProviderRuntimeConfig) -> None:
        if config.model.strip() == "":
            raise ValueError("ollama provider requires model")

    def create_model(self, config: ProviderRuntimeConfig) -> ChatOllama:
        self.validate(config)
        kwargs = {
            "model": config.model,
            "base_url": config.base_url or "http://127.0.0.1:11434",
        }
        if config.temperature is not None:
            kwargs["temperature"] = config.temperature
        return ChatOllama(**kwargs)
