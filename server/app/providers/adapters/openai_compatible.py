from __future__ import annotations

from langchain_openai import ChatOpenAI

from ..base import ProviderRuntimeConfig


class OpenAICompatibleAdapter:
    provider_type = "openai_compatible"

    def validate(self, config: ProviderRuntimeConfig) -> None:
        if config.provider_key is None or config.provider_key.strip() == "":
            raise ValueError("openai_compatible provider requires provider_key")
        if config.model.strip() == "":
            raise ValueError("openai_compatible provider requires model")
        if config.base_url is None or config.base_url.strip() == "":
            raise ValueError("openai_compatible provider requires base_url")

    def create_model(self, config: ProviderRuntimeConfig) -> ChatOpenAI:
        self.validate(config)
        kwargs = {
            "model": config.model,
            "base_url": config.base_url,
            # langchain_openai currently requires api_key at construction time.
            "api_key": config.api_key or "__NO_API_KEY__",
        }
        if config.headers:
            kwargs["default_headers"] = config.headers
        if config.temperature is not None:
            kwargs["temperature"] = config.temperature
        return ChatOpenAI(**kwargs)
