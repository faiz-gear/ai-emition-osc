import unittest

from server.app.services.emotion_queue import EmotionTaskQueue


class EmotionTaskQueueTests(unittest.IsolatedAsyncioTestCase):
    async def test_latest_policy_keeps_only_latest_pending_task(self):
        queue = EmotionTaskQueue(policy="latest", maxsize=1)

        first, dropped_first = await queue.enqueue("u1", "text-1")
        self.assertEqual(first.utterance_id, "u1")
        self.assertEqual(dropped_first, [])

        second, dropped_second = await queue.enqueue("u2", "text-2")
        self.assertEqual(second.utterance_id, "u2")
        self.assertEqual([item.utterance_id for item in dropped_second], ["u1"])

        task = await queue.get()
        self.assertEqual(task.utterance_id, "u2")
        queue.task_done()

    async def test_generation_can_detect_stale_inflight_task(self):
        queue = EmotionTaskQueue(policy="latest", maxsize=1)

        task1, _ = await queue.enqueue("u1", "text-1")
        in_flight = await queue.get()
        self.assertEqual(in_flight.generation, task1.generation)

        await queue.enqueue("u2", "text-2")

        self.assertFalse(await queue.is_latest_generation(in_flight.generation))
        self.assertTrue(await queue.is_latest_generation(2))
        queue.task_done()


if __name__ == "__main__":
    unittest.main()
