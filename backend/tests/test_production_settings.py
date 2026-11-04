import os
import subprocess
import sys
import unittest
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
BASE_ENV = {
    "DJANGO_SECRET_KEY": "test-production-settings-secret",
    "DATABASE_URL": "postgres://test:test@localhost:5432/test",
    "REDIS_URL": "rediss://test.example:6379/0",
    "AWS_STORAGE_BUCKET_NAME": "test-bucket",
    "AWS_S3_ENDPOINT_URL": "https://objects.example.test",
    "AWS_S3_REGION_NAME": "test-region",
    "AWS_ACCESS_KEY_ID": "test-access-key",
    "AWS_SECRET_ACCESS_KEY": "test-secret-key",
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
    def test_s3_media_storage_keeps_whitenoise_for_static_files(self):
        result = run_production_settings(
            """
from config.settings import production as settings
assert settings.STORAGES["default"]["BACKEND"] == "storages.backends.s3.S3Storage"
assert settings.STORAGES["default"]["OPTIONS"]["bucket_name"] == "test-bucket"
assert settings.STORAGES["default"]["OPTIONS"]["querystring_auth"] is True
assert settings.STORAGES["default"]["OPTIONS"]["querystring_expire"] == 3600
assert settings.STORAGES["staticfiles"]["BACKEND"] == (
    "whitenoise.storage.CompressedManifestStaticFilesStorage"
)
assert settings.CHANNEL_LAYERS["default"]["CONFIG"]["hosts"] == [
    "rediss://test.example:6379/0"
]
assert settings.CACHES["default"]["BACKEND"] == (
    "django.core.cache.backends.redis.RedisCache"
)
assert settings.CACHES["default"]["LOCATION"] == "rediss://test.example:6379/0"
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

    def test_missing_s3_configuration_fails_clearly(self):
        result = run_production_settings(
            "from config.settings import production",
            AWS_SECRET_ACCESS_KEY="",
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("AWS_SECRET_ACCESS_KEY", result.stderr)
        self.assertIn("uploaded-media storage requires", result.stderr)

    def test_missing_redis_url_fails_clearly(self):
        result = run_production_settings(
            "from config.settings import production",
            REDIS_URL="",
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("REDIS_URL is missing", result.stderr)


if __name__ == "__main__":
    unittest.main()
