import os
import unittest

from server.app.core.config import load_config


class ProviderConfigTests(unittest.TestCase):
    def setUp(self) -> None:
        self._old_db_path = os.environ.get("AI_EMOTION_PROVIDER_DB_PATH")
        self._old_secret = os.environ.get("AI_EMOTION_PROVIDER_SECRET_KEY")

    def tearDown(self) -> None:
        if self._old_db_path is None:
            os.environ.pop("AI_EMOTION_PROVIDER_DB_PATH", None)
        else:
            os.environ["AI_EMOTION_PROVIDER_DB_PATH"] = self._old_db_path

        if self._old_secret is None:
            os.environ.pop("AI_EMOTION_PROVIDER_SECRET_KEY", None)
        else:
            os.environ["AI_EMOTION_PROVIDER_SECRET_KEY"] = self._old_secret

    def test_loads_provider_config_fields(self):
        os.environ["AI_EMOTION_PROVIDER_DB_PATH"] = "server/data/providers.db"
        os.environ["AI_EMOTION_PROVIDER_SECRET_KEY"] = "test-secret"
        cfg = load_config()
        self.assertEqual(cfg.provider_db_path, "server/data/providers.db")
        self.assertEqual(cfg.provider_secret_key, "test-secret")


if __name__ == "__main__":
    unittest.main()
