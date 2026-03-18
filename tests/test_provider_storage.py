import tempfile
import unittest
from pathlib import Path

from server.app.providers.base import StoredProviderWrite
from server.app.providers.storage import SqliteProviderRepository


class ProviderStorageTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.db_path = Path(self._tmp.name) / "providers.db"
        self.repo = SqliteProviderRepository(db_path=self.db_path)
        await self.repo.initialize(default_model="qwen2.5:3b")

    async def asyncTearDown(self) -> None:
        self._tmp.cleanup()

    async def test_initialize_creates_schema_and_default_active(self):
        active = await self.repo.get_active()
        self.assertIsNotNone(active)
        assert active is not None
        self.assertEqual(active.provider_type, "ollama")
        self.assertTrue(active.is_active)
        self.assertEqual(active.model, "qwen2.5:3b")

    async def test_name_must_be_unique(self):
        await self.repo.create(
            StoredProviderWrite(
                name="openai-main",
                provider_type="openai",
                provider_key=None,
                model="gpt-4.1-mini",
                base_url=None,
                headers_encrypted=None,
                api_key_encrypted="secret-1",
                temperature=0.6,
                is_active=False,
            )
        )

        with self.assertRaises(ValueError):
            await self.repo.create(
                StoredProviderWrite(
                    name="openai-main",
                    provider_type="openai",
                    provider_key=None,
                    model="gpt-4.1-mini",
                    base_url=None,
                    headers_encrypted=None,
                    api_key_encrypted="secret-2",
                    temperature=0.3,
                    is_active=False,
                )
            )

    async def test_only_one_active_provider(self):
        openai = await self.repo.create(
            StoredProviderWrite(
                name="openai-main",
                provider_type="openai",
                provider_key=None,
                model="gpt-4.1-mini",
                base_url=None,
                headers_encrypted=None,
                api_key_encrypted="secret-1",
                temperature=0.6,
                is_active=False,
            )
        )
        compatible = await self.repo.create(
            StoredProviderWrite(
                name="compat-main",
                provider_type="openai_compatible",
                provider_key="my-compat",
                model="my-model",
                base_url="http://localhost:1234/v1",
                headers_encrypted=None,
                api_key_encrypted=None,
                temperature=0.4,
                is_active=False,
            )
        )

        await self.repo.set_active(openai.id)
        first_active = await self.repo.get_active()
        self.assertIsNotNone(first_active)
        assert first_active is not None
        self.assertEqual(first_active.id, openai.id)

        await self.repo.set_active(compatible.id)
        second_active = await self.repo.get_active()
        self.assertIsNotNone(second_active)
        assert second_active is not None
        self.assertEqual(second_active.id, compatible.id)

        all_rows = await self.repo.list()
        active_count = sum(1 for item in all_rows if item.is_active)
        self.assertEqual(active_count, 1)


if __name__ == "__main__":
    unittest.main()
