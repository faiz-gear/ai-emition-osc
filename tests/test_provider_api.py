import asyncio
import tempfile
import unittest
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.app.api.providers import router as providers_router
from server.app.providers.crypto import ProviderCrypto
from server.app.providers.registry import ProviderRegistry
from server.app.providers.service import ProviderService
from server.app.providers.storage import SqliteProviderRepository


class ProviderApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.db_path = Path(self._tmp.name) / "providers.db"
        self.repo = SqliteProviderRepository(self.db_path)
        asyncio.run(self.repo.initialize(default_model="qwen2.5:3b"))
        service = ProviderService(
            repository=self.repo,
            registry=ProviderRegistry.default(),
            crypto=ProviderCrypto("0123456789abcdef0123456789abcdef"),
        )

        app = FastAPI()
        app.state.provider_service = service
        app.include_router(providers_router)
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.client.close()
        self._tmp.cleanup()

    def test_post_provider_returns_201(self):
        response = self.client.post(
            "/api/providers",
            json={
                "name": "openai-main",
                "provider_type": "openai",
                "model": "gpt-4o-mini",
                "api_key": "sk-test",
                "temperature": 0.4,
            },
        )
        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(body["name"], "openai-main")
        self.assertEqual(body["provider_type"], "openai")

    def test_activate_missing_returns_provider_not_found(self):
        response = self.client.post("/api/providers/missing/activate")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"]["code"], "PROVIDER_NOT_FOUND")

    def test_delete_active_allows_no_active_state(self):
        active_before = self.client.get("/api/providers/active")
        self.assertEqual(active_before.status_code, 200)
        active_id = active_before.json()["id"]

        deleted = self.client.delete(f"/api/providers/{active_id}")
        self.assertEqual(deleted.status_code, 204)

        active_after = self.client.get("/api/providers/active")
        self.assertEqual(active_after.status_code, 404)
        self.assertEqual(
            active_after.json()["detail"]["code"],
            "PROVIDER_ACTIVE_NOT_SET",
        )


if __name__ == "__main__":
    unittest.main()
