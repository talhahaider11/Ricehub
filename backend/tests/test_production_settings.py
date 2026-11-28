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
    "R2_ACCESS_KEY_ID": "test-access-key",
    "R2_SECRET_ACCESS_KEY": "test-secret-key",
    "R2_BUCKET_NAME": "test-bucket",
    "R2_ENDPOINT_URL": "https://test-account.r2.cloudflarestorage.com",
    "R2_PUBLIC_DOMAIN": "cdn.example.com",
    "OCI_ACCESS_KEY_ID": "oci-test-access-key",
    "OCI_SECRET_ACCESS_KEY": "oci-test-secret-key",
    "OCI_BUCKET_NAME": "oci-test-bucket",
    "OCI_ENDPOINT_URL": "https://objectstorage.example.com",
    "OCI_REGION": "us-ashburn-1",
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
    def test_r2_media_storage_keeps_whitenoise_for_static_files(self):
        result = run_production_settings(
            """
from config.settings import production as settings
assert settings.STORAGES["default"]["BACKEND"] == "storages.backends.s3.S3Storage"
assert settings.STORAGES["default"]["OPTIONS"]["bucket_name"] == "test-bucket"
assert settings.STORAGES["default"]["OPTIONS"]["endpoint_url"] == (
    "https://test-account.r2.cloudflarestorage.com"
)
assert settings.STORAGES["default"]["OPTIONS"]["region_name"] == "auto"
assert settings.STORAGES["default"]["OPTIONS"]["signature_version"] == "s3v4"
assert settings.STORAGES["default"]["OPTIONS"]["custom_domain"] == "cdn.example.com"
assert settings.STORAGES["default"]["OPTIONS"]["querystring_auth"] is False
assert settings.STORAGES["default"]["OPTIONS"]["default_acl"] is None
assert settings.AWS_S3_CUSTOM_DOMAIN == "cdn.example.com"
assert settings.AWS_QUERYSTRING_AUTH is False
assert settings.AWS_DEFAULT_ACL is None
assert settings.STORAGES["default"]["OPTIONS"]["file_overwrite"] is False
assert settings.STORAGES["default"]["OPTIONS"]["object_parameters"] == {
    "CacheControl": "max-age=86400"
}
assert settings.MEDIA_URL == "https://cdn.example.com/"
assert settings.STORAGES["oci_media"]["BACKEND"] == (
    "storages.backends.s3boto3.S3Boto3Storage"
)
assert settings.STORAGES["oci_media"]["OPTIONS"]["bucket_name"] == "oci-test-bucket"
assert settings.STORAGES["oci_media"]["OPTIONS"]["endpoint_url"] == (
    "https://objectstorage.example.com"
)
assert settings.STORAGES["oci_media"]["OPTIONS"]["querystring_auth"] is False
assert settings.STORAGES["oci_chat_media"]["OPTIONS"]["querystring_auth"] is False
assert settings.STORAGES["oci_chat_media"]["OPTIONS"]["object_parameters"] == {
    "CacheControl": "public, max-age=31536000, immutable"
}
from storages.backends.s3boto3 import S3Boto3Storage
oci_storage = S3Boto3Storage(**settings.STORAGES["oci_media"]["OPTIONS"])
oci_url = oci_storage.url("chat_media/2026/11/test.jpg")
assert oci_url.startswith(
    "https://objectstorage.example.com/oci-test-bucket/chat_media/"
)
assert "?" not in oci_url
chat_storage = S3Boto3Storage(**settings.STORAGES["oci_chat_media"]["OPTIONS"])
chat_url = chat_storage.url("chat_media/2026/11/test.jpg")
assert chat_url.startswith(
    "https://objectstorage.example.com/oci-test-bucket/chat_media/"
)
assert "?" not in chat_url
assert settings.STORAGES["staticfiles"]["BACKEND"] == (
    "whitenoise.storage.CompressedStaticFilesStorage"
)
assert settings.CHANNEL_LAYERS["default"]["CONFIG"]["hosts"] == [
    {
        "address": "rediss://test.example:6379/0",
        "protocol": 2,
        "socket_connect_timeout": 10,
        "socket_timeout": None,
        "retry_on_timeout": True,
        "health_check_interval": 30,
    }
]
assert settings.CHANNEL_LAYERS["default"]["CONFIG"]["capacity"] == 1500
assert settings.CHANNEL_LAYERS["default"]["CONFIG"]["expiry"] == 10
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

    def test_missing_r2_configuration_fails_instead_of_using_ephemeral_storage(self):
        result = run_production_settings(
            "from config.settings import production",
            R2_ACCESS_KEY_ID="",
            R2_SECRET_ACCESS_KEY="",
            R2_BUCKET_NAME="",
            R2_ENDPOINT_URL="",
            R2_PUBLIC_DOMAIN="",
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(
            "Cloudflare R2 must be fully configured",
            result.stderr,
        )

    def test_missing_oci_configuration_fails_for_post_and_chat_media(self):
        result = run_production_settings(
            "from config.settings import production",
            OCI_ACCESS_KEY_ID="",
            OCI_SECRET_ACCESS_KEY="",
            OCI_BUCKET_NAME="",
            OCI_ENDPOINT_URL="",
            OCI_REGION="",
            ORACLE_ACCESS_KEY_ID="",
            ORACLE_SECRET_ACCESS_KEY="",
            ORACLE_BUCKET_NAME="",
            ORACLE_S3_ENDPOINT_URL="",
            ORACLE_REGION="",
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(
            "OCI Object Storage must be fully configured",
            result.stderr,
        )

    def test_r2_public_domain_is_normalized_before_building_media_urls(self):
        result = run_production_settings(
            """
from config.settings import production as settings
assert settings.AWS_S3_CUSTOM_DOMAIN == "cdn.example.com"
assert settings.MEDIA_URL == "https://cdn.example.com/"
""",
            R2_PUBLIC_DOMAIN="https://cdn.example.com/",
        )
        self.assertEqual(result.returncode, 0, result.stderr)

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
