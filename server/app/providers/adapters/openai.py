from __future__ import annotations

from langchain_openai import ChatOpenAI

from ..base import ProviderRuntimeConfig, ProviderType


class OpenAIAdapter:
    provider_type: ProviderType = "openai"

    def validate(self, config: ProviderRuntimeConfig) -> None:
        if config.model.strip() == "":
            raise ValueError("openai provider requires model")
        if config.api_key is None or config.api_key.strip() == "":
            raise ValueError("openai provider requires api_key")

    def create_model(self, config: ProviderRuntimeConfig) -> ChatOpenAI:
        self.validate(config)
        kwargs = {
            "model": config.model,
            "api_key": config.api_key,
        }
        if config.base_url:
            kwargs["base_url"] = config.base_url
        if config.headers:
            kwargs["default_headers"] = config.headers
        if config.temperature is not None:
            kwargs["temperature"] = config.temperature
        return ChatOpenAI(**kwargs)
