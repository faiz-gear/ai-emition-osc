from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _get_env_str(name: str, default: str) -> str:
    value = os.environ.get(name)
    return default if value is None or value.strip() == "" else value


def _get_env_int(name: str, default: int) -> int:
    value = os.environ.get(name)
    if value is None or value.strip() == "":
        return default
    return int(value)


def _get_env_float(name: str, default: float) -> float:
    value = os.environ.get(name)
    if value is None or value.strip() == "":
        return default
    return float(value)


def _get_env_csv(name: str, default: list[str]) -> list[str]:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    items = [part.strip() for part in raw.split(",")]
    return [item for item in items if item]


@dataclass(frozen=True)
class AppConfig:
    server_host: str
    server_port: int
    allowed_origins: list[str]
    event_buffer_size: int
    max_ws_queue_size: int

    vosk_model_path: str
    sample_rate: int
    blocksize: int
    silence_threshold: int
    min_speech_duration: float
    max_silence_duration: float
    partial_throttle_seconds: float

    llm_model: str
    llm_temperature: float
    prompt_template_path: Path
    provider_db_path: str
    provider_secret_key: str

    osc_ip: str
    osc_port: int

    metrics_push_interval_seconds: float
    emotion_queue_policy: str
    emotion_queue_maxsize: int


def load_config() -> AppConfig:
    queue_policy = _get_env_str("AI_EMOTION_QUEUE_POLICY", "latest").lower()
    if queue_policy not in {"latest", "fifo"}:
        queue_policy = "latest"

    return AppConfig(
        server_host=_get_env_str("AI_EMOTION_SERVER_HOST", "127.0.0.1"),
        server_port=_get_env_int("AI_EMOTION_SERVER_PORT", 8000),
        allowed_origins=_get_env_csv(
            "AI_EMOTION_ALLOWED_ORIGINS", ["http://localhost:3000"]
        ),
        event_buffer_size=_get_env_int("AI_EMOTION_EVENT_BUFFER_SIZE", 200),
        max_ws_queue_size=_get_env_int("AI_EMOTION_MAX_WS_QUEUE_SIZE", 200),
        vosk_model_path=_get_env_str("AI_EMOTION_VOSK_MODEL", "vosk-model-small-cn"),
        sample_rate=_get_env_int("AI_EMOTION_SAMPLE_RATE", 16000),
        blocksize=_get_env_int("AI_EMOTION_BLOCKSIZE", 2000),
        silence_threshold=_get_env_int("AI_EMOTION_SILENCE_THRESHOLD", 500),
        min_speech_duration=_get_env_float("AI_EMOTION_MIN_SPEECH_DURATION", 0.3),
        max_silence_duration=_get_env_float("AI_EMOTION_MAX_SILENCE_DURATION", 0.5),
        partial_throttle_seconds=_get_env_float("AI_EMOTION_PARTIAL_THROTTLE", 0.2),
        llm_model=_get_env_str("AI_EMOTION_LLM_MODEL", "deepseek-r1:1.5b"),
        llm_temperature=_get_env_float("AI_EMOTION_LLM_TEMPERATURE", 0.6),
        prompt_template_path=Path(
            _get_env_str("AI_EMOTION_PROMPT_TEMPLATE", "prompt_template.txt")
        ),
        provider_db_path=_get_env_str(
            "AI_EMOTION_PROVIDER_DB_PATH", "server/data/providers.db"
        ),
        provider_secret_key=_get_env_str("AI_EMOTION_PROVIDER_SECRET_KEY", ""),
        osc_ip=_get_env_str("AI_EMOTION_OSC_IP", "127.0.0.1"),
        osc_port=_get_env_int("AI_EMOTION_OSC_PORT", 7000),
        metrics_push_interval_seconds=_get_env_float(
            "AI_EMOTION_METRICS_INTERVAL", 1.0
        ),
        emotion_queue_policy=queue_policy,
        emotion_queue_maxsize=max(1, _get_env_int("AI_EMOTION_QUEUE_MAXSIZE", 1)),
    )
