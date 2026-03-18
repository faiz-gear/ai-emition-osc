from __future__ import annotations

import asyncio
import contextlib
import time
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.http import router as http_router
from .api.ws import router as ws_router
from .core.config import AppConfig, load_config
from .services.asr_service import AsrService
from .services.emotion_service import EmotionService
from .services.hub import Hub
from .services.osc_service import OscService


async def _metrics_loop(app: FastAPI) -> None:
    hub = app.state.hub
    config: AppConfig = app.state.config
    try:
        while True:
            await hub.publish_metrics()
            await asyncio.sleep(config.metrics_push_interval_seconds)
    except asyncio.CancelledError:
        raise


async def _emotion_worker(app: FastAPI) -> None:
    hub = app.state.hub
    queue: asyncio.Queue[tuple[str, str]] = app.state.emotion_queue
    emotion_service: EmotionService = app.state.emotion_service
    osc_service: OscService = app.state.osc_service

    try:
        while True:
            utterance_id, text = await queue.get()
            try:
                await hub.record_emotion_start(utterance_id=utterance_id)
                start = time.perf_counter()
                emotion = await emotion_service.analyze_text(text)
                latency_ms = (time.perf_counter() - start) * 1000.0

                osc_service.send_emotion(emotion.dimensions)
                await hub.record_emotion_result(
                    utterance_id=utterance_id,
                    emotion=emotion,
                    latency_ms=latency_ms,
                )
            except Exception as exc:
                await hub.record_error(
                    message=f"情绪分析失败: {exc}", utterance_id=utterance_id
                )
            finally:
                queue.task_done()
    except asyncio.CancelledError:
        raise


def create_app() -> FastAPI:
    config = load_config()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        hub = Hub(config)
        emotion_queue: asyncio.Queue[tuple[str, str]] = asyncio.Queue()
        emotion_service = EmotionService.from_config(config)
        osc_service = OscService(config)

        async def on_partial(utterance_id, started_at, partial_text, audio_level):
            await hub.record_asr_partial(
                utterance_id=utterance_id,
                started_at=started_at,
                partial_text=partial_text,
                audio_level=audio_level,
            )

        async def on_final(utterance_id, started_at, ended_at, final_text):
            await hub.record_asr_final(
                utterance_id=utterance_id,
                started_at=started_at,
                ended_at=ended_at,
                final_text=final_text,
            )
            await emotion_queue.put((utterance_id, final_text))

        async def on_error(message: str):
            await hub.record_error(message=message)

        asr_service = AsrService(
            config,
            on_partial=on_partial,
            on_final=on_final,
            on_error=on_error,
        )

        app.state.config = config
        app.state.hub = hub
        app.state.emotion_queue = emotion_queue
        app.state.emotion_service = emotion_service
        app.state.osc_service = osc_service
        app.state.asr_service = asr_service

        emotion_task = asyncio.create_task(_emotion_worker(app))
        metrics_task = asyncio.create_task(_metrics_loop(app))
        app.state._background_tasks = [emotion_task, metrics_task]

        yield

        with contextlib.suppress(Exception):
            await asr_service.stop()

        for task in getattr(app.state, "_background_tasks", []):
            task.cancel()
        for task in getattr(app.state, "_background_tasks", []):
            with contextlib.suppress(Exception):
                await task

    app = FastAPI(lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(http_router)
    app.include_router(ws_router)
    return app


app = create_app()

