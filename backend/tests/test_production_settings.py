import os
import subprocess
import sys
import unittest
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
BASE_ENV = {
    "DJANGO_SECRET_KEY": "test-production-settings-secret",
    "DJANGO_DEBUG": "False",
    "DATABASE_URL": "postgres://test:test@localhost:5432/test",
    "REDIS_URL": "rediss://test.example:6379/0",
    "OCI_OBJECT_STORAGE_NAMESPACE": "test-namespace",
    "OCI_OBJECT_STORAGE_BUCKET": "test-bucket",
    "OCI_OBJECT_STORAGE_REGION": "test-region",
    "OCI_OBJECT_STORAGE_ACCESS_KEY": "test-access-key",
    "OCI_OBJECT_STORAGE_SECRET_KEY": "test-secret-key",
}


def run_production_settings(script, **overrides):
    env = os.environ.copy()
    env.update(BASE_ENV)
    env.update(overrides)
    return subprocess.run(
        [sys.executable, "-c", script],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


class ProductionSettingsTests(unittest.TestCase):
    def test_oci_media_storage_keeps_whitenoise_for_static_files(self):
        result = run_production_settings(
            """
from config.settings import production as settings
assert settings.STORAGES["default"]["BACKEND"] == "storages.backends.s3.S3Storage"
assert settings.STORAGES["default"]["OPTIONS"]["bucket_name"] == "test-bucket"
assert settings.STORAGES["default"]["OPTIONS"]["endpoint_url"] == (
    "https://test-namespace.compat.objectstorage.test-region.oraclecloud.com"
)
assert settings.STORAGES["default"]["OPTIONS"]["querystring_auth"] is True
assert settings.STORAGES["default"]["OPTIONS"]["querystring_expire"] == 3600
assert settings.STORAGES["staticfiles"]["BACKEND"] == (
    "whitenoise.storage.CompressedStaticFilesStorage"
)
assert settings.CHANNEL_LAYERS["default"]["CONFIG"]["hosts"] == [
    {"address": "rediss://test.example:6379/0", "protocol": 2}
]
assert settings.CACHES["default"]["BACKEND"] == "django_redis.cache.RedisCache"
assert settings.CACHES["default"]["LOCATION"] == "rediss://test.example:6379/0"
assert settings.CACHES["default"]["OPTIONS"]["CONNECTION_POOL_KWARGS"] == {
    "protocol": 2
}
assert settings.SECURE_SSL_REDIRECT is True
assert settings.SESSION_COOKIE_SECURE is True
assert settings.CSRF_COOKIE_SECURE is True
assert settings.X_FRAME_OPTIONS == "DENY"
assert settings.CORS_ALLOW_ALL_ORIGINS is False
assert settings.SECURE_PROXY_SSL_HEADER == (
    "HTTP_X_FORWARDED_PROTO",
    "https",
)
assert settings.DATABASES["default"]["ENGINE"] == "django.db.backends.postgresql"
assert settings.DATABASES["default"]["OPTIONS"]["sslmode"] == "require"
assert settings.MIDDLEWARE.count(
    "whitenoise.middleware.WhiteNoiseMiddleware"
) == 1
assert settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["login"] == "5/minute"
assert settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["post_create"] == "10/hour"
"""
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_missing_oci_configuration_uses_local_media_storage_with_warning(self):
        result = run_production_settings(
            """
from config.settings import production as settings
assert settings.STORAGES["default"]["BACKEND"] == (
    "django.core.files.storage.FileSystemStorage"
)
""",
            OCI_OBJECT_STORAGE_SECRET_KEY="",
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("OCI Object Storage is not fully configured", result.stderr)

    def test_missing_redis_url_fails_clearly(self):
        result = run_production_settings(
            "from config.settings import production",
            REDIS_URL="",
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("REDIS_URL is missing", result.stderr)

    def test_production_settings_cannot_be_overridden_by_legacy_environment(self):
        result = run_production_settings(
            """
from config.settings import production as settings
assert settings.DEBUG is False
assert settings.SECRET_KEY == "test-production-settings-secret"
assert "*" not in settings.ALLOWED_HOSTS
assert settings.CORS_ALLOW_ALL_ORIGINS is False
assert settings.SECURE_SSL_REDIRECT is True
""",
            DEBUG="True",
            ALLOWED_HOSTS="*",
            CORS_ALLOW_ALL_ORIGINS="True",
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_explicit_cors_origins_keep_local_development_origins(self):
        result = run_production_settings(
            """
from config.settings import production as settings
assert "https://ricehub-frontend.onrender.com" in settings.CORS_ALLOWED_ORIGINS
assert "http://127.0.0.1:5173" in settings.CORS_ALLOWED_ORIGINS
assert "http://localhost:5173" in settings.CORS_ALLOWED_ORIGINS
assert "http://127.0.0.1:5173" in settings.CSRF_TRUSTED_ORIGINS
assert settings.CORS_ALLOW_ALL_ORIGINS is False
""",
            CORS_ALLOWED_ORIGINS="https://ricehub-frontend.onrender.com",
        )
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
