
import os
from pathlib import Path

import dj_database_url

from .base import *


# --------------------------------------------------
# General production settings
# --------------------------------------------------

DEBUG = os.environ.get("DJANGO_DEBUG", "False").lower() == "true"

SECRET_KEY = (
    os.environ.get("DJANGO_SECRET_KEY")
    or os.environ.get("SECRET_KEY")
)

if not SECRET_KEY:
    raise RuntimeError(
        "DJANGO_SECRET_KEY or SECRET_KEY must be set in production."
    )

BASE_DIR = Path(__file__).resolve().parent.parent

if "whitenoise.middleware.WhiteNoiseMiddleware" not in MIDDLEWARE:
    MIDDLEWARE.insert(2, "whitenoise.middleware.WhiteNoiseMiddleware")


# --------------------------------------------------
# Static and uploaded files
# --------------------------------------------------

INSTALLED_APPS.append("storages")

MEDIA_STORAGE_ENV_VARS = (
    "AWS_STORAGE_BUCKET_NAME",
    "AWS_S3_ENDPOINT_URL",
    "AWS_S3_REGION_NAME",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
)
missing_media_storage_vars = [
    name for name in MEDIA_STORAGE_ENV_VARS if not os.environ.get(name, "").strip()
]
if missing_media_storage_vars:
    raise RuntimeError(
        "Production uploaded-media storage requires these environment "
        f"variables: {', '.join(missing_media_storage_vars)}."
    )

STORAGES = {
    "default": {
        "BACKEND": "storages.backends.s3.S3Storage",
        "OPTIONS": {
            "bucket_name": os.environ["AWS_STORAGE_BUCKET_NAME"].strip(),
            "endpoint_url": os.environ["AWS_S3_ENDPOINT_URL"].strip(),
            "region_name": os.environ["AWS_S3_REGION_NAME"].strip(),
            "access_key": os.environ["AWS_ACCESS_KEY_ID"].strip(),
            "secret_key": os.environ["AWS_SECRET_ACCESS_KEY"].strip(),
            "custom_domain": os.environ.get("AWS_S3_CUSTOM_DOMAIN", "").strip()
            or None,
            "querystring_auth": True,
            "querystring_expire": 3600,
        },
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}


# --------------------------------------------------
# Hosts, CORS and CSRF
# --------------------------------------------------

ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get(
        "DJANGO_ALLOWED_HOSTS",
        "localhost,127.0.0.1,[::1],ricehub-backend.onrender.com,"
        "ricehub-umfd.onrender.com",
    ).split(",")
    if host.strip()
]
render_hostname = os.environ.get("RENDER_EXTERNAL_HOSTNAME")
if render_hostname and render_hostname not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(render_hostname)

CSRF_TRUSTED_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.environ.get(
        "CSRF_TRUSTED_ORIGINS",
        "https://ricehub-frontend.onrender.com,"
        "https://ricehub.onrender.com,"
        "https://ricehub-umfd.onrender.com,"
        "http://localhost:5173,"
        "http://127.0.0.1:5173,"
        "http://localhost:3000,"
        "https://localhost,"
        "http://localhost",
    ).split(",")
    if origin.strip()
]

CORS_ALLOWED_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.environ.get(
        "CORS_ALLOWED_ORIGINS",
        "https://ricehub-frontend.onrender.com,"
        "https://ricehub.onrender.com,"
        "https://ricehub-umfd.onrender.com,"
        "http://localhost:5173,"
        "http://127.0.0.1:5173,"
        "http://localhost:3000,"
        "https://localhost,"
        "http://localhost",
    ).split(",")
    if origin.strip()
]
frontend_origin = os.environ.get(
    "FRONTEND_URL",
    "https://ricehub-frontend.onrender.com",
).rstrip("/")
vercel_origins = {
    value.strip().rstrip("/")
    for value in (
        os.environ.get("VERCEL_URL", ""),
        os.environ.get("VERCEL_PROJECT_PRODUCTION_URL", ""),
    )
    if value.strip()
}
vercel_origins = {
    origin
    if origin.startswith(("http://", "https://"))
    else f"https://{origin}"
    for origin in vercel_origins
}
frontend_origins = {
    "https://ricehub-frontend.onrender.com",
    "https://ricehub.onrender.com",
    frontend_origin,
    *vercel_origins,
}
for origin in frontend_origins:
    if origin and origin not in CORS_ALLOWED_ORIGINS:
        CORS_ALLOWED_ORIGINS.append(origin)
CORS_ALLOW_ALL_ORIGINS = False

for origin in frontend_origins:
    if origin and origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(origin)


# --------------------------------------------------
# HTTPS and security
# --------------------------------------------------

SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

SECURE_PROXY_SSL_HEADER = (
    "HTTP_X_FORWARDED_PROTO",
    "https",
)

SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"


# --------------------------------------------------
# Logging
# --------------------------------------------------

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
}


# --------------------------------------------------
# PostgreSQL database
# --------------------------------------------------

DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is missing. Production must use PostgreSQL."
    )

DATABASES = {
    "default": dj_database_url.parse(
        DATABASE_URL,
        conn_max_age=600,
        conn_health_checks=True,
        ssl_require=True,
    )
}


# --------------------------------------------------
# Gmail SMTP email settings
# --------------------------------------------------

EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"

EMAIL_HOST = os.environ.get("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))

EMAIL_USE_TLS = (
    os.environ.get("EMAIL_USE_TLS", "True").lower() == "true"
)

EMAIL_USE_SSL = (
    os.environ.get("EMAIL_USE_SSL", "False").lower() == "true"
)

EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")

DEFAULT_FROM_EMAIL = os.environ.get(
    "DEFAULT_FROM_EMAIL",
    EMAIL_HOST_USER,
)

EMAIL_TIMEOUT = 20


# --------------------------------------------------
# Redis / Django Channels
# --------------------------------------------------

REDIS_URL = os.environ.get("REDIS_URL", "").strip()
if not REDIS_URL:
    raise RuntimeError(
        "REDIS_URL is missing. Production Django Channels requires Redis."
    )

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [REDIS_URL],
        },
    },
}

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_URL,
        "KEY_PREFIX": "ricehub",
        "TIMEOUT": 60 * 60 * 24,
    },
}
