from __future__ import annotations

from pythonosc import udp_client

from ..core.config import AppConfig
from ..models.events import EmotionDimensions


class OscService:
    def __init__(self, config: AppConfig):
        self._client = udp_client.SimpleUDPClient(config.osc_ip, config.osc_port)

    def send_emotion(self, dimensions: EmotionDimensions) -> None:
        try:
            self._client.send_message("/emotion", [dimensions.model_dump()])
        except Exception:
            return

