import asyncio
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.app.api.providers import router as providers_router
from server.app.providers.base import ProviderTestResult
from server.app.providers.crypto import ProviderCrypto
from server.app.providers.errors import (
    ProviderAuthFailedError,
    ProviderRateLimitedError,
)
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
        self.app = app
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
        self.assertEqual(response.json()["code"], "PROVIDER_NOT_FOUND")

    def test_delete_active_allows_no_active_state(self):
        active_before = self.client.get("/api/providers/active")
        self.assertEqual(active_before.status_code, 200)
        active_id = active_before.json()["id"]

        deleted = self.client.delete(f"/api/providers/{active_id}")
        self.assertEqual(deleted.status_code, 204)

        active_after = self.client.get("/api/providers/active")
        self.assertEqual(active_after.status_code, 404)
        self.assertEqual(
            active_after.json()["code"],
            "PROVIDER_ACTIVE_NOT_SET",
        )

    def test_create_activate_status_and_delete_provider_flow(self):
        created = self.client.post(
            "/api/providers",
            json={
                "name": "workflow-openai",
                "provider_type": "openai",
                "model": "gpt-4o-mini",
                "api_key": "sk-test",
            },
        )
        self.assertEqual(created.status_code, 201)
        provider_id = created.json()["id"]

        activated = self.client.post(f"/api/providers/{provider_id}/activate")
        self.assertEqual(activated.status_code, 200)
        self.assertTrue(activated.json()["is_active"])

        listed = self.client.get("/api/providers")
        self.assertEqual(listed.status_code, 200)
        active_count = sum(1 for item in listed.json() if item["is_active"])
        self.assertEqual(active_count, 1)

        deleted = self.client.delete(f"/api/providers/{provider_id}")
        self.assertEqual(deleted.status_code, 204)

        active_after = self.client.get("/api/providers/active")
        self.assertEqual(active_after.status_code, 404)
        self.assertEqual(
            active_after.json()["code"],
            "PROVIDER_ACTIVE_NOT_SET",
        )

    def test_patch_name_null_returns_validation_error(self):
        created = self.client.post(
            "/api/providers",
            json={
                "name": "openai-main",
                "provider_type": "openai",
                "model": "gpt-4o-mini",
                "api_key": "sk-test",
            },
        )
        self.assertEqual(created.status_code, 201)
        provider_id = created.json()["id"]

        patched = self.client.patch(
            f"/api/providers/{provider_id}",
            json={"name": None},
        )
        self.assertEqual(patched.status_code, 422)
        self.assertEqual(patched.json()["code"], "PROVIDER_VALIDATION_FAILED")

    def test_provider_test_error_mapping(self):
        active_before = self.client.get("/api/providers/active")
        self.assertEqual(active_before.status_code, 200)
        provider_id = active_before.json()["id"]

        self.app.state.provider_service.test_provider = AsyncMock(
            side_effect=ProviderAuthFailedError()
        )
        auth_resp = self.client.post(f"/api/providers/{provider_id}/test")
        self.assertEqual(auth_resp.status_code, 401)
        self.assertEqual(auth_resp.json()["code"], "PROVIDER_AUTH_FAILED")

        self.app.state.provider_service.test_provider = AsyncMock(
            side_effect=ProviderRateLimitedError()
        )
        rate_resp = self.client.post(f"/api/providers/{provider_id}/test")
        self.assertEqual(rate_resp.status_code, 429)
        self.assertEqual(rate_resp.json()["code"], "PROVIDER_RATE_LIMITED")

        self.app.state.provider_service.test_provider = AsyncMock(
            return_value=ProviderTestResult(ok=True, latency_ms=12.3)
        )
        ok_resp = self.client.post(f"/api/providers/{provider_id}/test")
        self.assertEqual(ok_resp.status_code, 200)
        self.assertEqual(ok_resp.json()["ok"], True)


if __name__ == "__main__":
    unittest.main()
