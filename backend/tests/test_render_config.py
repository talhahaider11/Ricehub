from pathlib import Path
import unittest

import yaml


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


class RenderDeploymentConfigTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with (REPOSITORY_ROOT / "render.yaml").open(encoding="utf-8") as file:
            cls.services = yaml.safe_load(file)["services"]

    def test_web_service_checks_production_and_collects_static_files(self):
        web_service = next(
            service
            for service in self.services
            if service["type"] == "web"
        )
        web_env = {
            entry["key"]: entry.get("value")
            for entry in web_service["envVars"]
        }

        self.assertEqual(web_service["healthCheckPath"], "/health/")
        self.assertEqual(web_env["DJANGO_SETTINGS_MODULE"], "config.settings.production")
        self.assertIn("check --deploy", web_service["buildCommand"])
        self.assertIn("collectstatic --noinput", web_service["buildCommand"])
        self.assertNotIn("migrate", web_service["buildCommand"])
        self.assertIn("daphne", web_service["startCommand"])

    def test_required_production_secrets_are_not_committed_to_render_manifest(self):
        web_service = next(
            service
            for service in self.services
            if service["type"] == "web"
        )
        worker_service = next(
            service
            for service in self.services
            if service["type"] == "worker"
        )
        web_env = {
            entry["key"]: entry
            for entry in web_service["envVars"]
        }
        worker_env = {
            entry["key"]: entry
            for entry in worker_service["envVars"]
        }

        for key in (
            "DJANGO_SECRET_KEY",
            "DB_PASSWORD",
            "DB_SERVICE_NAME",
            "REDIS_URL",
            "OCI_OBJECT_STORAGE_NAMESPACE",
            "OCI_OBJECT_STORAGE_BUCKET",
            "OCI_OBJECT_STORAGE_REGION",
            "OCI_OBJECT_STORAGE_ACCESS_KEY",
            "OCI_OBJECT_STORAGE_SECRET_KEY",
            "BREVO_API_KEY",
            "BREVO_SENDER_EMAIL",
        ):
            self.assertIs(web_env[key]["sync"], False, key)

        self.assertNotIn("DEFAULT_FROM_EMAIL", web_env)
        self.assertIs(worker_env["FIREBASE_CREDENTIALS_JSON"]["sync"], False)
        self.assertIn("ricehub-celery-worker", worker_service["name"])

    def test_frontend_static_site_builds_with_production_urls_and_spa_rewrites(self):
        frontend_service = next(
            service
            for service in self.services
            if service["type"] == "static"
        )
        frontend_env = {
            entry["key"]: entry.get("value")
            for entry in frontend_service["envVars"]
        }

        self.assertEqual(frontend_service["name"], "ricehub-frontend")
        self.assertEqual(frontend_service["rootDir"], "frontend")
        self.assertEqual(frontend_service["buildCommand"], "npm ci && npm run build")
        self.assertEqual(frontend_service["staticPublishPath"], "dist")
        self.assertEqual(
            frontend_env["VITE_API_URL"],
            "https://ricehub-umfd.onrender.com/api",
        )
        self.assertEqual(
            frontend_env["VITE_WS_URL"],
            "wss://ricehub-umfd.onrender.com/ws",
        )
        self.assertIn(
            {
                "type": "rewrite",
                "source": "/*",
                "destination": "/index.html",
            },
            frontend_service["routes"],
        )


if __name__ == "__main__":
    unittest.main()
