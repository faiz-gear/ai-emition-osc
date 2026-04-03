import unittest
from datetime import datetime, timezone
from pathlib import Path

from server.app.core.config import AppConfig
from server.app.services.hub import Hub


def _config() -> AppConfig:
    return AppConfig(
        server_host="127.0.0.1",
        server_port=8000,
        allowed_origins=["http://localhost:3000"],
        event_buffer_size=200,
        max_ws_queue_size=200,
        vosk_model_path="vosk-model-small-cn",
        sample_rate=16000,
        blocksize=2000,
        silence_threshold=500,
        min_speech_duration=0.3,
        max_silence_duration=0.5,
        partial_throttle_seconds=0.2,
        llm_model="qwen2.5:3b",
        llm_temperature=0.6,
        prompt_template_path=Path("prompt_template.txt"),
        provider_db_path="server/data/providers.db",
        provider_secret_key="test-secret",
        osc_ip="127.0.0.1",
        osc_port=7000,
        metrics_push_interval_seconds=1.0,
        emotion_queue_policy="latest",
        emotion_queue_maxsize=1,
    )


class HubDroppedTests(unittest.IsolatedAsyncioTestCase):
    async def test_record_emotion_dropped_marks_status_and_metrics(self):
        hub = Hub(_config())
        started = datetime.now(timezone.utc)
        ended = datetime.now(timezone.utc)

        await hub.record_asr_final(
            utterance_id="u1",
            started_at=started,
            ended_at=ended,
            final_text="hello",
        )

        await hub.record_emotion_dropped(utterance_id="u1", reason="queue_replaced")

        utterances = await hub.get_utterances(limit=10)
        self.assertEqual(utterances[0].emotion_status.value, "dropped")

        status = await hub.get_status_response()
        self.assertEqual(status.metrics.emotion_dropped_total, 1)
        self.assertIsNone(status.config.active_provider)
        self.assertIsNone(status.config.active_model)


if __name__ == "__main__":
    unittest.main()
