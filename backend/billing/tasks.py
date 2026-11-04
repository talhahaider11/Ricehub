from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from users.models import User

from .services import SUBSCRIPTION_GRACE_DAYS


@shared_task
def expire_verification_subscriptions():
    expired = User.objects.filter(
        is_verified=True,
        subscription_expires_at__isnull=False,
        subscription_expires_at__lt=(
            timezone.now() - timedelta(days=SUBSCRIPTION_GRACE_DAYS)
        ),
    )
    return expired.update(is_verified=False)
