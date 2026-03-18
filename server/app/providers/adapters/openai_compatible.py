from __future__ import annotations

from typing import Any, Dict, Optional

import requests
from langchain_openai import ChatOpenAI
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, ChatMessage, HumanMessage, SystemMessage
from langchain_core.outputs import ChatGeneration, ChatResult

from ..base import ProviderRuntimeConfig


class OpenAICompatibleNoAuthChatModel(BaseChatModel):
    model_name: str
    base_url: str
    headers: Optional[Dict[str, str]] = None
    temperature: Optional[float] = None
    timeout_seconds: float = 20.0

    @property
    def _llm_type(self) -> str:
        return "openai_compatible_noauth"

    @staticmethod
    def _to_openai_message(message: BaseMessage) -> dict[str, Any]:
        if isinstance(message, HumanMessage):
            role = "user"
        elif isinstance(message, SystemMessage):
            role = "system"
        elif isinstance(message, ChatMessage):
            role = message.role
        else:
            role = "assistant"
        return {"role": role, "content": message.content}

    def _generate(self, messages, stop=None, run_manager=None, **kwargs) -> ChatResult:
        payload: dict[str, Any] = {
            "model": self.model_name,
            "messages": [self._to_openai_message(item) for item in messages],
        }
        if self.temperature is not None:
            payload["temperature"] = self.temperature
        if stop:
            payload["stop"] = stop
        endpoint = self.base_url.rstrip("/") + "/chat/completions"
        response = requests.post(
            endpoint,
            json=payload,
            headers=self.headers,
            timeout=self.timeout_seconds,
        )
        response.raise_for_status()
        data = response.json()
        choices = data.get("choices") or []
        if not choices:
            raise ValueError("Provider response missing choices")
        content = choices[0].get("message", {}).get("content", "")
        generation = ChatGeneration(message=AIMessage(content=str(content)))
        return ChatResult(generations=[generation], llm_output={"raw": data})


class OpenAICompatibleAdapter:
    provider_type = "openai_compatible"

    def validate(self, config: ProviderRuntimeConfig) -> None:
        if config.provider_key is None or config.provider_key.strip() == "":
            raise ValueError("openai_compatible provider requires provider_key")
        if config.model.strip() == "":
            raise ValueError("openai_compatible provider requires model")
        if config.base_url is None or config.base_url.strip() == "":
            raise ValueError("openai_compatible provider requires base_url")

    def create_model(self, config: ProviderRuntimeConfig) -> BaseChatModel:
        self.validate(config)
        if config.api_key is None or config.api_key.strip() == "":
            return OpenAICompatibleNoAuthChatModel(
                model_name=config.model,
                base_url=config.base_url or "",
                headers=config.headers,
                temperature=config.temperature,
            )
        kwargs = {
            "model": config.model,
            "base_url": config.base_url,
            "api_key": config.api_key,
        }
        if config.headers:
            kwargs["default_headers"] = config.headers
        if config.temperature is not None:
            kwargs["temperature"] = config.temperature
        return ChatOpenAI(**kwargs)
