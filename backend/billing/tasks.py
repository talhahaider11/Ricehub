from datetime import timedelta

from celery import shared_task
from django.db import transaction
from django.utils import timezone

from notifications.models import Notification
from notifications.services import create_notification
from users.models import User

from .services import SUBSCRIPTION_GRACE_DAYS


@shared_task
def expire_verification_subscriptions():
    now = timezone.now()
    expired_subscriptions = User.objects.filter(
        subscription_expires_at__isnull=False,
        subscription_expires_at__lte=now,
    ).values_list("pk", flat=True)

    for user_id in expired_subscriptions.iterator():
        with transaction.atomic():
            user = User.objects.select_for_update().filter(pk=user_id).first()
            if (
                user is None
                or user.subscription_expires_at is None
                or user.subscription_expires_at > now
            ):
                continue

            expiry_message = (
                f"Your monthly verification expired on "
                f"{user.subscription_expires_at.date().isoformat()}. "
                "Renew now to keep your verified badge."
            )
            if not Notification.objects.filter(
                recipient=user,
                notification_type=Notification.NotificationType.SUBSCRIPTION_EXPIRED,
                message=expiry_message,
            ).exists():
                create_notification(
                    recipient=user,
                    notification_type=Notification.NotificationType.SUBSCRIPTION_EXPIRED,
                    message=expiry_message,
                )

    expired = User.objects.filter(
        is_verified=True,
        subscription_expires_at__isnull=False,
        subscription_expires_at__lte=(
            now - timedelta(days=SUBSCRIPTION_GRACE_DAYS)
        ),
    )
    return expired.update(is_verified=False)
