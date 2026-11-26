import os
from pathlib import Path
from datetime import timedelta
from importlib import import_module
import dj_database_url
from django.db.backends.base.base import BaseDatabaseWrapper
import dj_database_url

BaseDatabaseWrapper.check_database_version_supported = lambda self: None

try:
    dj_database_url = import_module("dj_database_url")
except ImportError:
    dj_database_url = None

try:
    load_dotenv = import_module("dotenv").load_dotenv
except ImportError:
    def load_dotenv(*args, **kwargs):
        return False

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.getenv(
    "DJANGO_SECRET_KEY",
    "this-is-a-long-random-secret-for-local-development-use-only-1234567890",
)

DEBUG = os.getenv("DJANGO_DEBUG", "False").lower() == "true"

EMAIL_BACKEND = os.getenv(
    "EMAIL_BACKEND",
    (
        "users.email_backends.BrevoEmailBackend"
        if os.getenv("BREVO_API_KEY")
        else "django.core.mail.backends.smtp.EmailBackend"
        if os.getenv("EMAIL_HOST") and os.getenv("EMAIL_HOST_USER") and os.getenv("EMAIL_HOST_PASSWORD")
        else "django.core.mail.backends.console.EmailBackend"
        if DEBUG
        else "django.core.mail.backends.smtp.EmailBackend"
    ),
)

# Brevo API Configurations
BREVO_API_KEY = os.getenv("BREVO_API_KEY", "").strip()
BREVO_SENDER_EMAIL = os.getenv("BREVO_SENDER_EMAIL", "").strip()
BREVO_SENDER_NAME = os.getenv("BREVO_SENDER_NAME", "RiceHub").strip()

DEFAULT_FROM_EMAIL = (
    os.getenv("DEFAULT_FROM_EMAIL", "").strip()
    or BREVO_SENDER_EMAIL
    or "noreply@localhost"
)

EMAIL_TIMEOUT = int(os.getenv("EMAIL_TIMEOUT", "15"))

# Default Backend (Agar Environment specify na ho)
EMAIL_BACKEND = os.getenv(
    "EMAIL_BACKEND", 
    "users.email_backends.BrevoEmailBackend"
)

FRONTEND_URL = os.getenv("FRONTEND_URL", "https://ricehub-frontend.onrender.com")

# Dynamic Allowed Hosts for Render and Local Environments
ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv(
        "DJANGO_ALLOWED_HOSTS",
        "localhost,127.0.0.1,[::1],.onrender.com"
    ).split(",")
    if host.strip()
]

# Render automatically environment variable `RENDER_EXTERNAL_HOST` pass karta hai
RENDER_EXTERNAL_HOST = os.getenv("RENDER_EXTERNAL_HOST")
if RENDER_EXTERNAL_HOST:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOST)

render_hostname = os.environ.get("RENDER_EXTERNAL_HOSTNAME")
if render_hostname and render_hostname not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(render_hostname)

if "ricehub-umfd.onrender.com" not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append("ricehub-umfd.onrender.com")

# Channel Layers (Redis setup for WebSockets)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", REDIS_URL)
CELERY_TASK_SERIALIZER = "json"
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_RESULT_SERIALIZER = "json"
CELERY_TASK_ALWAYS_EAGER = (
    os.environ.get("CELERY_TASK_ALWAYS_EAGER", "False") == "True"
)
SECURITY_EVENT_RETENTION_DAYS = int(
    os.getenv("SECURITY_EVENT_RETENTION_DAYS", "90")
)
if SECURITY_EVENT_RETENTION_DAYS < 1:
    raise ValueError("SECURITY_EVENT_RETENTION_DAYS must be at least 1.")
CELERY_BEAT_SCHEDULE = {
    "delete-expired-stories-hourly": {
        "task": "stories.tasks.delete_expired_stories",
        "schedule": 3600.0,
    },
    "purge-expired-security-events-daily": {
        "task": "users.tasks.purge_expired_security_events",
        "schedule": 86400.0,
    },
    "expire-verification-subscriptions-hourly": {
        "task": "billing.tasks.expire_verification_subscriptions",
        "schedule": 3600.0,
    },
}
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [
                {
                    "address": REDIS_URL,
                    "protocol": 2,
                    "socket_connect_timeout": 10,
                    "socket_timeout": None,
                    "retry_on_timeout": True,
                    "health_check_interval": 30,
                }
            ],
            "capacity": 1500,
            "expiry": 10,
        },
    },
}

INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",

    "drf_spectacular",
    "users",
    "posts",
    "comments",
    "reactions",
    "friendships",
    "messaging",
    "notifications",
    "search",
    "community",
    "moderation",
    "administration.apps.AdministrationConfig",
    "feed",
    "stories",
    "media_app.apps.MediaConfig",
    "billing.apps.BillingConfig",
]

MIDDLEWARE = [
    "config.middleware.RequestIDMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # Render Static Files Serving
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# Production Security Configurations
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin"
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = not DEBUG
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
X_FRAME_OPTIONS = "DENY"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

ROOT_URLCONF = "config.urls"

ASGI_APPLICATION = "config.asgi.application"
WSGI_APPLICATION = "config.wsgi.application"

# Database setup using Render environment variable
if dj_database_url is None and os.environ.get("DATABASE_URL"):
    raise RuntimeError("Install dj-database-url to use DATABASE_URL.")



# Load environment variables from .env file (if python-dotenv is installed)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-fallback-key')
DEBUG = os.environ.get('DEBUG', 'True') == 'True'

# Database Configuration
DATABASE_URL = os.environ.get("DATABASE_URL")

if DATABASE_URL:
    # Render / Production deployment using DATABASE_URL environment variable
    DATABASES = {
        'default': dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=600,
            ssl_require=True
        )
    }
    DATABASES['default'].setdefault('OPTIONS', {}).setdefault(
        'sslmode',
        'require',
    )
else:
    # Direct PostgreSQL connection reading dynamically from .env
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('DB_NAME', ""),
            'USER': os.environ.get('DB_USER', ""),
            'PASSWORD': os.environ.get('DB_PASSWORD'),
            'HOST': os.environ.get('DB_HOST', " "),
            'PORT': os.environ.get('DB_PORT', '5432'),
            'CONN_MAX_AGE': 600,
            'CONN_HEALTH_CHECKS': True,
            'OPTIONS': {
                'sslmode': os.environ.get('DB_SSLMODE', 'disable'),
            },
        }
    }

AUTH_USER_MODEL = "users.User"

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Karachi"

USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID", "").strip()
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY", "").strip()
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME", "").strip()
R2_ENDPOINT_URL = os.getenv("R2_ENDPOINT_URL", "").strip()
R2_PUBLIC_DOMAIN = (
    os.getenv("R2_PUBLIC_DOMAIN", "")
    .strip()
    .removeprefix("https://")
    .removeprefix("http://")
    .rstrip("/")
)

AWS_S3_CUSTOM_DOMAIN = R2_PUBLIC_DOMAIN
AWS_QUERYSTRING_AUTH = False
AWS_DEFAULT_ACL = None
AWS_S3_REGION_NAME = "auto"
AWS_S3_SIGNATURE_VERSION = "s3v4"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "config.permissions.IsActiveAndNotSuspended",
    ),
    "DEFAULT_PAGINATION_CLASS": (
        "config.pagination.StandardPagination"
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "PAGE_SIZE": 10,
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "config.throttling.BurstRateThrottle",
        "config.throttling.SustainedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "300/minute",
        "user": "600/minute",
        "login": "5/minute",
        "register": "5/hour",
        "password": "5/hour",
        "refresh": "20/minute",
        "message": "60/minute",
        "post_create": "10/hour",
        "media_upload": "20/hour",
        "burst": "600/minute",
        "sustained": "50000/day",
        "moderation": "10/hour",
        "report": "10/hour",
        "admin": "300/minute",
    },
    "EXCEPTION_HANDLER": "config.exception.custom_exception_handler",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=3650),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

MAX_IMAGE_SIZE = 5 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

R2_CONFIGURATION = {
    "R2_ACCESS_KEY_ID": R2_ACCESS_KEY_ID,
    "R2_SECRET_ACCESS_KEY": R2_SECRET_ACCESS_KEY,
    "R2_BUCKET_NAME": R2_BUCKET_NAME,
    "R2_ENDPOINT_URL": R2_ENDPOINT_URL,
    "R2_PUBLIC_DOMAIN": R2_PUBLIC_DOMAIN,
}
if any(R2_CONFIGURATION.values()):
    missing_r2_settings = [
        name
        for name, value in R2_CONFIGURATION.items()
        if not value
    ]
    if missing_r2_settings:
        raise ValueError(
            "R2 storage credentials require: "
            + ", ".join(missing_r2_settings)
        )
    if "storages" not in INSTALLED_APPS:
        INSTALLED_APPS.append("storages")
    MEDIA_URL = f"https://{R2_PUBLIC_DOMAIN}/"
    STORAGES["default"] = {
        "BACKEND": "storages.backends.s3.S3Storage",
        "OPTIONS": {
            "bucket_name": R2_BUCKET_NAME,
            "endpoint_url": R2_ENDPOINT_URL,
            "region_name": AWS_S3_REGION_NAME,
            "signature_version": AWS_S3_SIGNATURE_VERSION,
            "access_key": R2_ACCESS_KEY_ID,
            "secret_key": R2_SECRET_ACCESS_KEY,
            "custom_domain": AWS_S3_CUSTOM_DOMAIN,
            "querystring_auth": AWS_QUERYSTRING_AUTH,
            "default_acl": AWS_DEFAULT_ACL,
            "file_overwrite": False,
            "object_parameters": {"CacheControl": "max-age=86400"},
        },
    }

# CORS and CSRF Settings for Mobile App & Render Frontend
CORS_ALLOWED_ORIGINS = [
    "https://ricehub-frontend.onrender.com",
    "http://localhost:3000",
    "http://localhost:5173",
    "https://localhost",
    "http://localhost",
    
]

CSRF_TRUSTED_ORIGINS = [
    "https://ricehub-frontend.onrender.com",
    "https://ricehub-umfd.onrender.com",
]

CORS_ALLOW_CREDENTIALS = True


CORS_ALLOW_ALL_ORIGINS = True

OCI_OBJECT_STORAGE_NAMESPACE = os.getenv('OCI_OBJECT_STORAGE_NAMESPACE')
OCI_OBJECT_STORAGE_BUCKET = os.getenv('OCI_OBJECT_STORAGE_BUCKET')
OCI_OBJECT_STORAGE_REGION = os.getenv('OCI_OBJECT_STORAGE_REGION')
OCI_OBJECT_STORAGE_ACCESS_KEY = os.getenv('OCI_OBJECT_STORAGE_ACCESS_KEY')
OCI_OBJECT_STORAGE_SECRET_KEY = os.getenv('OCI_OBJECT_STORAGE_SECRET_KEY')

# Debugging Log Check
if not all([OCI_OBJECT_STORAGE_NAMESPACE, OCI_OBJECT_STORAGE_BUCKET, OCI_OBJECT_STORAGE_REGION, OCI_OBJECT_STORAGE_ACCESS_KEY, OCI_OBJECT_STORAGE_SECRET_KEY]):
    print("WARNING: OCI Object Storage variables missing in environment!")