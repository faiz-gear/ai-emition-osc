from __future__ import annotations

import asyncio
import contextlib
import time
import uuid
from collections import OrderedDict, deque
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import WebSocket

from ..core.config import AppConfig
from ..models.events import (
    ConfigSummary,
    EmotionResult,
    EmotionStatus,
    EventEnvelope,
    EventType,
    Metrics,
    SnapshotPayload,
    Status,
    StatusResponse,
    Utterance,
)


@dataclass
class WsConnection:
    websocket: WebSocket
    outgoing: asyncio.Queue[dict[str, Any]]
    writer_task: asyncio.Task


class Hub:
    def __init__(self, config: AppConfig):
        self._config = config

        self._connections: dict[int, WsConnection] = {}
        self._connections_lock = asyncio.Lock()

        self._utterances: OrderedDict[str, Utterance] = OrderedDict()
        self._state_lock = asyncio.Lock()

        self._started_at = time.monotonic()
        self._listening = False
        self._last_error: Optional[str] = None

        self._utterances_total = 0
        self._emotion_total = 0
        self._errors_total = 0
        self._emotion_latencies_ms: deque[float] = deque(maxlen=50)

    @staticmethod
    def _now() -> datetime:
        return datetime.now(timezone.utc)

    def _uptime_seconds(self) -> float:
        return time.monotonic() - self._started_at

    async def register(self, websocket: WebSocket) -> None:
        outgoing: asyncio.Queue[dict[str, Any]] = asyncio.Queue(
            maxsize=self._config.max_ws_queue_size
        )
        writer_task = asyncio.create_task(self._writer(websocket, outgoing))
        connection = WsConnection(
            websocket=websocket,
            outgoing=outgoing,
            writer_task=writer_task,
        )

        async with self._connections_lock:
            self._connections[id(websocket)] = connection

    async def unregister(self, websocket: WebSocket) -> None:
        connection: Optional[WsConnection] = None
        async with self._connections_lock:
            connection = self._connections.pop(id(websocket), None)

        if connection is None:
            return

        connection.writer_task.cancel()
        with contextlib.suppress(Exception):
            await connection.writer_task

    async def _writer(
        self, websocket: WebSocket, outgoing: asyncio.Queue[dict[str, Any]]
    ) -> None:
        try:
            while True:
                payload = await outgoing.get()
                await websocket.send_json(payload)
        except asyncio.CancelledError:
            raise
        except Exception:
            return

    async def _enqueue(self, websocket: WebSocket, payload: dict[str, Any]) -> None:
        async with self._connections_lock:
            connection = self._connections.get(id(websocket))

        if connection is None:
            return

        try:
            connection.outgoing.put_nowait(payload)
        except asyncio.QueueFull:
            with contextlib.suppress(asyncio.QueueEmpty):
                connection.outgoing.get_nowait()
            with contextlib.suppress(asyncio.QueueFull):
                connection.outgoing.put_nowait(payload)

    async def broadcast(self, event: EventEnvelope) -> None:
        payload = event.model_dump(mode="json")
        async with self._connections_lock:
            connections = list(self._connections.values())

        for connection in connections:
            try:
                connection.outgoing.put_nowait(payload)
            except asyncio.QueueFull:
                with contextlib.suppress(asyncio.QueueEmpty):
                    connection.outgoing.get_nowait()
                with contextlib.suppress(asyncio.QueueFull):
                    connection.outgoing.put_nowait(payload)

    async def ws_clients(self) -> int:
        async with self._connections_lock:
            return len(self._connections)

    async def set_listening(self, listening: bool) -> None:
        async with self._state_lock:
            self._listening = listening

    async def last_error(self) -> Optional[str]:
        async with self._state_lock:
            return self._last_error

    async def get_status_response(self) -> StatusResponse:
        async with self._state_lock:
            listening = self._listening
            last_error = self._last_error
            utterances_total = self._utterances_total
            emotion_total = self._emotion_total
            errors_total = self._errors_total
            latencies = list(self._emotion_latencies_ms)

        ws_clients = await self.ws_clients()
        avg_latency = sum(latencies) / len(latencies) if latencies else None

        metrics = Metrics(
            uptime_seconds=self._uptime_seconds(),
            ws_clients=ws_clients,
            utterances_total=utterances_total,
            emotion_total=emotion_total,
            errors_total=errors_total,
            avg_emotion_latency_ms=avg_latency,
        )
        config = ConfigSummary(
            vosk_model_path=self._config.vosk_model_path,
            sample_rate=self._config.sample_rate,
            llm_model=self._config.llm_model,
            osc_target=f"{self._config.osc_ip}:{self._config.osc_port}",
            event_buffer_size=self._config.event_buffer_size,
        )
        return StatusResponse(
            status=Status(listening=listening),
            metrics=metrics,
            config=config,
            last_error=last_error,
        )

    async def get_utterances(self, limit: int) -> list[Utterance]:
        if limit <= 0:
            return []

        async with self._state_lock:
            items = list(self._utterances.values())

        items = items[-limit:]
        items.reverse()
        return items

    def _new_event(self, event_type: EventType, data: Any) -> EventEnvelope:
        return EventEnvelope(
            id=str(uuid.uuid4()),
            ts=self._now(),
            type=event_type,
            data=data,
        )

    async def send_snapshot(self, websocket: WebSocket) -> None:
        status = await self.get_status_response()
        utterances = await self.get_utterances(limit=self._config.event_buffer_size)
        payload = SnapshotPayload(status=status, utterances=utterances)
        event = self._new_event("snapshot", payload)
        await self._enqueue(websocket, event.model_dump(mode="json"))

    async def publish_status(self) -> None:
        status = await self.get_status_response()
        await self.broadcast(self._new_event("status", status))

    async def publish_metrics(self) -> None:
        status = await self.get_status_response()
        await self.broadcast(self._new_event("metrics", status.metrics))

    async def record_asr_partial(
        self,
        *,
        utterance_id: str,
        started_at: datetime,
        partial_text: str,
        audio_level: int,
    ) -> None:
        async with self._state_lock:
            utterance = self._utterances.get(utterance_id)
            if utterance is None:
                utterance = Utterance(
                    id=utterance_id,
                    started_at=started_at,
                    partial_text=partial_text,
                    emotion_status=EmotionStatus.queued,
                )
                self._utterances[utterance_id] = utterance
                while len(self._utterances) > self._config.event_buffer_size:
                    self._utterances.popitem(last=False)
            else:
                utterance.partial_text = partial_text

        await self.broadcast(
            self._new_event(
                "asr_partial",
                {
                    "utterance_id": utterance_id,
                    "started_at": started_at,
                    "partial_text": partial_text,
                    "audio_level": audio_level,
                },
            )
        )

    async def record_asr_final(
        self,
        *,
        utterance_id: str,
        started_at: datetime,
        ended_at: datetime,
        final_text: str,
    ) -> None:
        should_increment = False

        async with self._state_lock:
            utterance = self._utterances.get(utterance_id)
            if utterance is None:
                utterance = Utterance(
                    id=utterance_id,
                    started_at=started_at,
                    ended_at=ended_at,
                    final_text=final_text,
                    emotion_status=EmotionStatus.queued,
                )
                self._utterances[utterance_id] = utterance
                should_increment = True
            else:
                if utterance.final_text is None:
                    should_increment = True
                utterance.ended_at = ended_at
                utterance.final_text = final_text
                utterance.partial_text = None
                utterance.emotion_status = EmotionStatus.queued

            while len(self._utterances) > self._config.event_buffer_size:
                self._utterances.popitem(last=False)

            if should_increment and final_text.strip():
                self._utterances_total += 1

        await self.broadcast(
            self._new_event(
                "asr_final",
                {
                    "utterance_id": utterance_id,
                    "started_at": started_at,
                    "ended_at": ended_at,
                    "final_text": final_text,
                },
            )
        )

    async def record_emotion_start(self, *, utterance_id: str) -> None:
        async with self._state_lock:
            utterance = self._utterances.get(utterance_id)
            if utterance is not None:
                utterance.emotion_status = EmotionStatus.processing

        await self.broadcast(
            self._new_event("emotion_start", {"utterance_id": utterance_id})
        )

    async def record_emotion_result(
        self,
        *,
        utterance_id: str,
        emotion: EmotionResult,
        latency_ms: float,
    ) -> None:
        async with self._state_lock:
            utterance = self._utterances.get(utterance_id)
            if utterance is not None:
                utterance.emotion = emotion
                utterance.latency_ms = latency_ms
                utterance.emotion_status = EmotionStatus.done

            self._emotion_total += 1
            self._emotion_latencies_ms.append(latency_ms)

        await self.broadcast(
            self._new_event(
                "emotion_result",
                {
                    "utterance_id": utterance_id,
                    "emotion": emotion,
                    "latency_ms": latency_ms,
                },
            )
        )

    async def record_error(self, *, message: str, utterance_id: Optional[str] = None):
        async with self._state_lock:
            self._errors_total += 1
            self._last_error = message

            if utterance_id:
                utterance = self._utterances.get(utterance_id)
                if utterance is not None:
                    utterance.emotion_status = EmotionStatus.error

        await self.broadcast(
            self._new_event(
                "error",
                {
                    "message": message,
                    "utterance_id": utterance_id,
                },
            )
        )
