from datetime import timedelta

from django.utils import timezone


PRESENCE_TIMEOUT_SECONDS = 45


def is_user_online(user):
    if not user.last_seen:
        return False

    timeout = timezone.now() - timedelta(
        seconds=PRESENCE_TIMEOUT_SECONDS
    )

    return user.last_seen >= timeout