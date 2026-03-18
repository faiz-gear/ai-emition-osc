import unittest

from server.app.providers.base import ProviderRuntimeConfig


class ProviderAdapterTests(unittest.TestCase):
    def _runtime(self, **overrides):
        payload = dict(
            id="p1",
            name="provider",
            provider_type="openai",
            provider_key=None,
            model="gpt-4o-mini",
            base_url=None,
            headers=None,
            api_key="test-key",
            temperature=0.5,
            is_active=False,
        )
        payload.update(overrides)
        return ProviderRuntimeConfig(**payload)

    def test_openai_requires_api_key(self):
        from server.app.providers.adapters.openai import OpenAIAdapter

        adapter = OpenAIAdapter()
        with self.assertRaises(ValueError):
            adapter.validate(self._runtime(api_key=None))

    def test_ollama_adapter_builds_chat_model(self):
        from server.app.providers.adapters.ollama import OllamaAdapter

        adapter = OllamaAdapter()
        cfg = self._runtime(
            provider_type="ollama",
            model="qwen2.5:3b",
            base_url="http://127.0.0.1:11434",
            api_key=None,
        )
        adapter.validate(cfg)
        model = adapter.create_model(cfg)
        self.assertEqual(getattr(model, "model", None), "qwen2.5:3b")
        self.assertEqual(getattr(model, "base_url", None), "http://127.0.0.1:11434")

    def test_openai_compatible_uses_custom_base_url(self):
        from server.app.providers.adapters.openai_compatible import (
            OpenAICompatibleAdapter,
        )

        adapter = OpenAICompatibleAdapter()
        cfg = self._runtime(
            provider_type="openai_compatible",
            provider_key="my-compat",
            model="custom-model",
            base_url="http://localhost:1234/v1",
            api_key=None,
            headers={"x-app": "ai-emotion"},
        )
        adapter.validate(cfg)
        model = adapter.create_model(cfg)
        self.assertEqual(getattr(model, "openai_api_base", None), "http://localhost:1234/v1")
        self.assertEqual(getattr(model, "default_headers", None), {"x-app": "ai-emotion"})

    def test_registry_returns_registered_adapter(self):
        from server.app.providers.registry import ProviderRegistry

        registry = ProviderRegistry.default()
        adapter = registry.get("ollama")
        self.assertEqual(adapter.provider_type, "ollama")


if __name__ == "__main__":
    unittest.main()
