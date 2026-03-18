from __future__ import annotations

import asyncio
from dataclasses import dataclass


QUEUE_POLICY_LATEST = "latest"
QUEUE_POLICY_FIFO = "fifo"


@dataclass(frozen=True)
class EmotionTask:
    utterance_id: str
    text: str
    generation: int


class EmotionTaskQueue:
    def __init__(self, *, policy: str, maxsize: int):
        self._policy = (
            QUEUE_POLICY_LATEST if policy != QUEUE_POLICY_FIFO else QUEUE_POLICY_FIFO
        )
        self._queue: asyncio.Queue[EmotionTask] = asyncio.Queue(maxsize=max(1, maxsize))
        self._generation = 0
        self._latest_generation = 0
        self._lock = asyncio.Lock()

    @property
    def policy(self) -> str:
        return self._policy

    async def enqueue(self, utterance_id: str, text: str) -> tuple[EmotionTask, list[EmotionTask]]:
        dropped: list[EmotionTask] = []
        async with self._lock:
            self._generation += 1
            task = EmotionTask(
                utterance_id=utterance_id,
                text=text,
                generation=self._generation,
            )
            self._latest_generation = task.generation

            if self._policy == QUEUE_POLICY_LATEST:
                dropped.extend(self._drain_pending_locked())
                if self._queue.full():
                    dropped.extend(self._drop_oldest_locked())
                self._queue.put_nowait(task)
            else:
                await self._queue.put(task)

            return task, dropped

    async def get(self) -> EmotionTask:
        return await self._queue.get()

    def task_done(self) -> None:
        self._queue.task_done()

    def qsize(self) -> int:
        return self._queue.qsize()

    async def is_latest_generation(self, generation: int) -> bool:
        async with self._lock:
            return generation == self._latest_generation

    def _drain_pending_locked(self) -> list[EmotionTask]:
        dropped: list[EmotionTask] = []
        while True:
            try:
                item = self._queue.get_nowait()
            except asyncio.QueueEmpty:
                break
            dropped.append(item)
            self._queue.task_done()
        return dropped

    def _drop_oldest_locked(self) -> list[EmotionTask]:
        try:
            item = self._queue.get_nowait()
        except asyncio.QueueEmpty:
            return []
        self._queue.task_done()
        return [item]
