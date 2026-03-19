import os
import tempfile
import unittest
from pathlib import Path

from server.app.core.config import load_config


class ProviderConfigTests(unittest.TestCase):
    def setUp(self) -> None:
        self._old_db_path = os.environ.get("AI_EMOTION_PROVIDER_DB_PATH")
        self._old_secret = os.environ.get("AI_EMOTION_PROVIDER_SECRET_KEY")
        self._old_model = os.environ.get("AI_EMOTION_LLM_MODEL")
        self._old_cwd = Path.cwd()

    def tearDown(self) -> None:
        if self._old_db_path is None:
            os.environ.pop("AI_EMOTION_PROVIDER_DB_PATH", None)
        else:
            os.environ["AI_EMOTION_PROVIDER_DB_PATH"] = self._old_db_path

        if self._old_secret is None:
            os.environ.pop("AI_EMOTION_PROVIDER_SECRET_KEY", None)
        else:
            os.environ["AI_EMOTION_PROVIDER_SECRET_KEY"] = self._old_secret

        if self._old_model is None:
            os.environ.pop("AI_EMOTION_LLM_MODEL", None)
        else:
            os.environ["AI_EMOTION_LLM_MODEL"] = self._old_model

        os.chdir(self._old_cwd)

    def test_loads_provider_config_fields(self):
        os.environ["AI_EMOTION_PROVIDER_DB_PATH"] = "server/data/providers.db"
        os.environ["AI_EMOTION_PROVIDER_SECRET_KEY"] = "test-secret"
        cfg = load_config()
        self.assertEqual(cfg.provider_db_path, "server/data/providers.db")
        self.assertEqual(cfg.provider_secret_key, "test-secret")

    def test_loads_values_from_dotenv_when_env_missing(self):
        os.environ.pop("AI_EMOTION_PROVIDER_SECRET_KEY", None)
        os.environ.pop("AI_EMOTION_LLM_MODEL", None)

        with tempfile.TemporaryDirectory() as tmpdir:
            temp_path = Path(tmpdir)
            (temp_path / ".env").write_text(
                "AI_EMOTION_PROVIDER_SECRET_KEY=dotenv-secret\n"
                "AI_EMOTION_LLM_MODEL=dotenv-model\n",
                encoding="utf-8",
            )
            os.chdir(temp_path)

            cfg = load_config()

        self.assertEqual(cfg.provider_secret_key, "dotenv-secret")
        self.assertEqual(cfg.llm_model, "dotenv-model")

    def test_environment_overrides_dotenv_values(self):
        os.environ["AI_EMOTION_PROVIDER_SECRET_KEY"] = "env-secret"
        os.environ["AI_EMOTION_LLM_MODEL"] = "env-model"

        with tempfile.TemporaryDirectory() as tmpdir:
            temp_path = Path(tmpdir)
            (temp_path / ".env").write_text(
                "AI_EMOTION_PROVIDER_SECRET_KEY=dotenv-secret\n"
                "AI_EMOTION_LLM_MODEL=dotenv-model\n",
                encoding="utf-8",
            )
            os.chdir(temp_path)

            cfg = load_config()

        self.assertEqual(cfg.provider_secret_key, "env-secret")
        self.assertEqual(cfg.llm_model, "env-model")


if __name__ == "__main__":
    unittest.main()
