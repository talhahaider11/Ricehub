import os

# Default to production settings for deployment safety, while still allowing
# a development override via DJANGO_ENV.
env_name = os.getenv("DJANGO_ENV", "production").lower()

if env_name == "development":
    from .development import *  # noqa: F401,F403
else:
    from .production import *  # noqa: F401,F403
