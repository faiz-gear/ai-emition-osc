from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class EmotionStatus(str, Enum):
    queued = "queued"
    processing = "processing"
    done = "done"
    dropped = "dropped"
    error = "error"


class EmotionDimensions(BaseModel):
    joy: float = Field(ge=0.0, le=1.0)
    trust: float = Field(ge=0.0, le=1.0)
    fear: float = Field(ge=0.0, le=1.0)
    surprise: float = Field(ge=0.0, le=1.0)
    sadness: float = Field(ge=0.0, le=1.0)
    disgust: float = Field(ge=0.0, le=1.0)
    anger: float = Field(ge=0.0, le=1.0)
    anticipation: float = Field(ge=0.0, le=1.0)


class EmotionResult(BaseModel):
    dimensions: EmotionDimensions
    dominant_emotion: str
    brief_explanation: str


class Utterance(BaseModel):
    id: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    partial_text: Optional[str] = None
    final_text: Optional[str] = None
    emotion: Optional[EmotionResult] = None
    emotion_status: EmotionStatus = EmotionStatus.queued
    latency_ms: Optional[float] = None


class Metrics(BaseModel):
    uptime_seconds: float
    ws_clients: int
    utterances_total: int
    emotion_total: int
    emotion_dropped_total: int = 0
    emotion_stale_total: int = 0
    emotion_queue_depth: int = 0
    errors_total: int
    avg_emotion_latency_ms: Optional[float] = None


class Status(BaseModel):
    listening: bool


class ConfigSummary(BaseModel):
    vosk_model_path: str
    sample_rate: int
    llm_model: str
    osc_target: str
    event_buffer_size: int
    emotion_queue_policy: str
    emotion_queue_maxsize: int


class StatusResponse(BaseModel):
    status: Status
    metrics: Metrics
    config: ConfigSummary
    last_error: Optional[str] = None


EventType = Literal[
    "snapshot",
    "status",
    "asr_partial",
    "asr_final",
    "emotion_start",
    "emotion_result",
    "emotion_dropped",
    "metrics",
    "error",
]


class EventEnvelope(BaseModel):
    id: str
    ts: datetime
    type: EventType
    data: Any


class SnapshotPayload(BaseModel):
    status: StatusResponse
    utterances: list[Utterance]
