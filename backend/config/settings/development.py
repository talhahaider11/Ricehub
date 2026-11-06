import os

from .base import *

DEBUG = True

if not (EMAIL_HOST and EMAIL_HOST_USER and EMAIL_HOST_PASSWORD):
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

OCI_PG_USER = os.environ.get("OCI_PG_USER", "").strip()
OCI_PG_PASSWORD = os.environ.get("OCI_PG_PASSWORD", "")
if not OCI_PG_USER or not OCI_PG_PASSWORD.strip():
    raise RuntimeError(
        "Set OCI_PG_USER and OCI_PG_PASSWORD in backend/.env to connect "
        "to the Oracle Cloud PostgreSQL database."
    )



CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    },
}

ALLOWED_HOSTS = [
    "127.0.0.1",
    "localhost",
]

CORS_ALLOW_ALL_ORIGINS = True
SECURE_SSL_REDIRECT = False
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
