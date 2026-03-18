from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

from langchain_ollama import ChatOllama

from ..core.config import AppConfig
from ..models.events import EmotionDimensions, EmotionResult


EMOTION_KEYS = [
    "joy",
    "trust",
    "fear",
    "surprise",
    "sadness",
    "disgust",
    "anger",
    "anticipation",
]


def _clamp_0_1(value: float) -> float:
    if value < 0.0:
        return 0.0
    if value > 1.0:
        return 1.0
    return value


def _extract_first_json_object(text: str) -> Optional[dict[str, Any]]:
    fenced_blocks = re.findall(r"```(?:json)?\s*(\{.*?\})\s*```", text, flags=re.DOTALL)
    decoder = json.JSONDecoder()

    for candidate in fenced_blocks:
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            return parsed

    for index, char in enumerate(text):
        if char != "{":
            continue
        try:
            parsed, _ = decoder.raw_decode(text[index:])
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            return parsed

    return None


def _normalize_emotion_payload(payload: dict[str, Any]) -> EmotionResult:
    dimensions_raw = payload.get("dimensions") or payload.get("emotions") or {}
    if not isinstance(dimensions_raw, dict):
        dimensions_raw = {}

    dimensions: dict[str, float] = {}
    for key in EMOTION_KEYS:
        raw_value = dimensions_raw.get(key, 0.0)
        try:
            value = float(raw_value)
        except (TypeError, ValueError):
            value = 0.0
        dimensions[key] = _clamp_0_1(value)

    dominant = payload.get("dominant_emotion")
    if isinstance(dominant, str) and dominant in EMOTION_KEYS + ["neutral"]:
        dominant_emotion = dominant
    else:
        max_key = max(dimensions, key=lambda k: dimensions[k], default="neutral")
        dominant_emotion = (
            "neutral" if dimensions.get(max_key, 0.0) < 0.3 else str(max_key)
        )

    brief_explanation = payload.get("brief_explanation")
    if not isinstance(brief_explanation, str):
        brief_explanation = ""

    return EmotionResult(
        dimensions=EmotionDimensions(**dimensions),
        dominant_emotion=dominant_emotion,
        brief_explanation=brief_explanation.strip()[:100],
    )


@dataclass(frozen=True)
class EmotionService:
    llm: ChatOllama
    prompt_template: str

    @staticmethod
    def _load_prompt_template(template_path: Path) -> str:
        path = template_path
        if not path.is_absolute():
            path = (Path.cwd() / path).resolve()
        return path.read_text(encoding="utf-8")

    @classmethod
    def from_config(cls, config: AppConfig) -> "EmotionService":
        llm = ChatOllama(model=config.llm_model, temperature=config.llm_temperature)
        template = cls._load_prompt_template(config.prompt_template_path)
        return cls(llm=llm, prompt_template=template)

    async def analyze_text(self, text: str) -> EmotionResult:
        prompt = (
            self.prompt_template.replace("{{USER_TEXT}}", text)
            .replace("{input_text}", text)
            .replace("<用户输入文本>", text)
        )

        response = await self.llm.ainvoke(prompt)
        content = getattr(response, "content", str(response))

        payload = _extract_first_json_object(content)
        if payload is None:
            raise ValueError("LLM 输出中未找到可解析的 JSON")

        return _normalize_emotion_payload(payload)

