import tempfile
import unittest
from pathlib import Path

from server.app.providers.base import CreateProviderInput, StoredProviderWrite
from server.app.providers.crypto import ProviderCrypto
from server.app.providers.errors import ProviderTypeImmutableError
from server.app.providers.registry import ProviderRegistry
from server.app.providers.service import ProviderService
from server.app.providers.storage import SqliteProviderRepository


class ProviderServiceTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.db_path = Path(self._tmp.name) / "providers.db"
        self.repo = SqliteProviderRepository(self.db_path)
        await self.repo.initialize(default_model="qwen2.5:3b")
        self.service = ProviderService(
            repository=self.repo,
            registry=ProviderRegistry.default(),
            crypto=ProviderCrypto("0123456789abcdef0123456789abcdef"),
        )

    async def asyncTearDown(self) -> None:
        self._tmp.cleanup()

    async def test_provider_type_is_immutable_on_patch(self):
        created = await self.service.create_provider(
            CreateProviderInput(
                name="openai-main",
                provider_type="openai",
                provider_key=None,
                model="gpt-4o-mini",
                base_url=None,
                temperature=0.4,
                api_key="sk-test",
                headers=None,
            )
        )

        with self.assertRaises(ProviderTypeImmutableError):
            await self.service.update_provider(
                created.id,
                {"provider_type": "openai_compatible"},
            )

    async def test_list_summaries_marks_degraded_on_secret_decrypt_error(self):
        await self.repo.create(
            StoredProviderWrite(
                name="broken-openai",
                provider_type="openai",
                provider_key=None,
                model="gpt-4o-mini",
                base_url=None,
                headers_encrypted="{not-json",
                api_key_encrypted="{also-not-json",
                temperature=0.5,
                is_active=False,
            )
        )

        summaries = await self.service.list_summaries()
        target = next((item for item in summaries if item.name == "broken-openai"), None)
        self.assertIsNotNone(target)
        assert target is not None
        self.assertEqual(target.status, "degraded")
        self.assertEqual(target.error_code, "PROVIDER_SECRET_DECRYPT_FAILED")
        self.assertIsNone(target.has_api_key)
        self.assertIsNone(target.headers_keys)


if __name__ == "__main__":
    unittest.main()
