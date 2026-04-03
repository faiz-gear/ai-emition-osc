from __future__ import annotations

import unittest

from server.app.services.emotion_service import EmotionService


def _payload(dominant: str) -> dict:
    return {
        "dimensions": {
            "joy": 0.8 if dominant == "joy" else 0.1,
            "trust": 0.2,
            "fear": 0.1,
            "surprise": 0.1,
            "sadness": 0.1,
            "disgust": 0.1,
            "anger": 0.1,
            "anticipation": 0.1,
        },
        "dominant_emotion": dominant,
        "brief_explanation": "test",
    }


class _FakeResponse:
    def __init__(self, content: str):
        self.content = content


class _FakeStructuredModel:
    def __init__(self, payload: dict):
        self._payload = payload

    async def ainvoke(self, prompt: str):
        return self._payload


class _FakeChatModel:
    def __init__(self, structured_payload: dict | None, raw_content: str):
        self._structured_payload = structured_payload
        self._raw_content = raw_content

    def with_structured_output(self, schema):
        if self._structured_payload is None:
            raise ValueError("structured output unavailable")
        return _FakeStructuredModel(self._structured_payload)

    async def ainvoke(self, prompt: str):
        return _FakeResponse(self._raw_content)


class _FakeProviderService:
    def __init__(self, model):
        self._model = model
        self.calls = 0

    async def get_active_chat_model(self):
        self.calls += 1
        return self._model


class EmotionServiceProviderTests(unittest.IsolatedAsyncioTestCase):
    async def test_analyze_uses_provider_service_model(self):
        provider_service = _FakeProviderService(
            _FakeChatModel(structured_payload=_payload("joy"), raw_content="")
        )
        service = EmotionService(
            provider_service=provider_service,
            prompt_template='Analyze: "{input_text}"',
        )

        result = await service.analyze_text("hello")

        self.assertEqual(provider_service.calls, 1)
        self.assertEqual(result.dominant_emotion, "joy")

    async def test_falls_back_to_json_extraction_when_structured_output_fails(self):
        raw = '{"dimensions":{"joy":0.2,"trust":0.2,"fear":0.1,"surprise":0.1,"sadness":0.1,"disgust":0.1,"anger":0.8,"anticipation":0.2},"dominant_emotion":"anger","brief_explanation":"fallback"}'
        provider_service = _FakeProviderService(
            _FakeChatModel(structured_payload=None, raw_content=raw)
        )
        service = EmotionService(
            provider_service=provider_service,
            prompt_template="Analyze {{USER_TEXT}}",
        )

        result = await service.analyze_text("hello")
        self.assertEqual(result.dominant_emotion, "anger")


if __name__ == "__main__":
    unittest.main()
