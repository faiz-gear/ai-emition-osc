from __future__ import annotations

import asyncio
import json
import queue
import time
import uuid
from collections.abc import Awaitable, Callable
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import numpy as np
import sounddevice as sd
from vosk import KaldiRecognizer, Model

from ..core.config import AppConfig


OnPartial = Callable[[str, datetime, str, int], Awaitable[None]]
OnFinal = Callable[[str, datetime, datetime, str], Awaitable[None]]
OnError = Callable[[str], Awaitable[None]]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_text(text: str) -> str:
    return " ".join(text.strip().split())


class AsrService:
    def __init__(
        self,
        config: AppConfig,
        *,
        on_partial: OnPartial,
        on_final: OnFinal,
        on_error: OnError,
    ):
        self._config = config
        self._on_partial = on_partial
        self._on_final = on_final
        self._on_error = on_error

        self._audio_queue: queue.Queue[bytes] = queue.Queue(maxsize=200)
        self._stream: Optional[sd.InputStream] = None

        self._model: Optional[Model] = None
        self._recognizer: Optional[KaldiRecognizer] = None

        self._running = False
        self._task: Optional[asyncio.Task] = None

        self._is_speaking = False
        self._utterance_id: Optional[str] = None
        self._started_at: Optional[datetime] = None
        self._last_speech_time = time.monotonic()
        self._speech_started_monotonic: Optional[float] = None

        self._final_parts: list[str] = []
        self._last_partial_sent_at = 0.0
        self._last_partial_text = ""

    def _audio_callback(self, indata, frames, time_info, status):
        if status:
            return
        try:
            self._audio_queue.put_nowait(bytes(indata))
        except queue.Full:
            return

    def _ensure_model_loaded(self) -> None:
        if self._model is not None and self._recognizer is not None:
            return

        model_path = Path(self._config.vosk_model_path)
        if not model_path.is_absolute():
            model_path = (Path.cwd() / model_path).resolve()

        if not model_path.exists():
            raise FileNotFoundError(
                f"Vosk 模型路径不存在: {model_path}。"
                "请先运行: python server/scripts/download_vosk_model.py"
            )

        self._model = Model(str(model_path))
        self._recognizer = KaldiRecognizer(self._model, self._config.sample_rate)
        self._recognizer.SetWords(True)

    @staticmethod
    def _audio_level(audio_data: bytes) -> int:
        samples = np.frombuffer(audio_data, dtype=np.int16)
        if samples.size == 0:
            return 0
        return int(np.max(np.abs(samples)))

    def _is_silence(self, audio_data: bytes) -> bool:
        return self._audio_level(audio_data) < self._config.silence_threshold

    async def start(self) -> None:
        if self._running:
            return

        self._ensure_model_loaded()
        assert self._recognizer is not None

        self._running = True

        self._stream = sd.InputStream(
            channels=1,
            dtype=np.int16,
            samplerate=self._config.sample_rate,
            callback=self._audio_callback,
            blocksize=self._config.blocksize,
        )
        self._stream.start()

        self._task = asyncio.create_task(self._run_loop())

    async def stop(self) -> None:
        if not self._running:
            return

        self._running = False

        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

        if self._stream is not None:
            try:
                self._stream.stop()
            finally:
                self._stream.close()
            self._stream = None

        self._reset_utterance()

    def _reset_utterance(self) -> None:
        self._is_speaking = False
        self._utterance_id = None
        self._started_at = None
        self._speech_started_monotonic = None
        self._final_parts = []
        self._last_partial_text = ""

    async def _run_loop(self) -> None:
        assert self._recognizer is not None

        try:
            while self._running:
                try:
                    audio_data = self._audio_queue.get_nowait()
                except queue.Empty:
                    await asyncio.sleep(0.01)
                    continue

                audio_level = self._audio_level(audio_data)
                is_silence = audio_level < self._config.silence_threshold

                now_monotonic = time.monotonic()

                if not is_silence:
                    self._last_speech_time = now_monotonic
                    if not self._is_speaking:
                        self._is_speaking = True
                        self._utterance_id = str(uuid.uuid4())
                        self._started_at = _now()
                        self._speech_started_monotonic = now_monotonic
                        self._final_parts = []
                        self._recognizer.Reset()

                self._recognizer.AcceptWaveform(audio_data)
                partial = ""
                try:
                    partial_payload = json.loads(self._recognizer.PartialResult())
                    partial = str(partial_payload.get("partial", "")).strip()
                except Exception:
                    partial = ""

                combined = _normalize_text(
                    " ".join([part for part in self._final_parts if part] + [partial])
                )

                if self._is_speaking:
                    should_send = (
                        combined
                        and combined != self._last_partial_text
                        and (now_monotonic - self._last_partial_sent_at)
                        >= self._config.partial_throttle_seconds
                    )
                    if should_send and self._utterance_id and self._started_at:
                        self._last_partial_sent_at = now_monotonic
                        self._last_partial_text = combined
                        await self._on_partial(
                            self._utterance_id, self._started_at, combined, audio_level
                        )

                if self._is_speaking and is_silence:
                    silence_duration = now_monotonic - self._last_speech_time
                    if silence_duration >= self._config.max_silence_duration:
                        await self._finalize_if_needed()
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            await self._on_error(f"ASR 运行错误: {exc}")
        finally:
            self._reset_utterance()

    async def _finalize_if_needed(self) -> None:
        assert self._recognizer is not None

        if not self._utterance_id or not self._started_at:
            self._reset_utterance()
            return

        if self._speech_started_monotonic is not None:
            duration = time.monotonic() - self._speech_started_monotonic
            if duration < self._config.min_speech_duration:
                self._reset_utterance()
                self._recognizer.Reset()
                return

        final_payload = {}
        try:
            final_payload = json.loads(self._recognizer.FinalResult())
        except Exception:
            final_payload = {}

        final_text = _normalize_text(str(final_payload.get("text", "")).strip())
        ended_at = _now()

        if final_text:
            await self._on_final(self._utterance_id, self._started_at, ended_at, final_text)

        self._recognizer.Reset()
        self._reset_utterance()

