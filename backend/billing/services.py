import logging
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from .models import PaymentRequest


SUBSCRIPTION_LENGTH_DAYS = 30
SUBSCRIPTION_GRACE_DAYS = 5
logger = logging.getLogger(__name__)


@transaction.atomic
def review_payment_request(payment_request_id, reviewer, approved):
    payment = (
        PaymentRequest.objects.select_for_update(of=("self",))
        .select_related("user", "post")
        .get(pk=payment_request_id)
    )
    if payment.status != PaymentRequest.Status.PENDING:
        return payment

    now = timezone.now()
    payment.status = (
        PaymentRequest.Status.APPROVED
        if approved
        else PaymentRequest.Status.REJECTED
    )
    payment.reviewed_by = reviewer
    payment.reviewed_at = now
    payment.save(update_fields=("status", "reviewed_by", "reviewed_at"))

    if not approved:
        return payment

    if payment.kind == PaymentRequest.Kind.SUBSCRIPTION:
        user = payment.user
        was_verified = user.is_verified
        current_expiry = user.subscription_expires_at
        starts_at = current_expiry if current_expiry and current_expiry > now else now
        user.subscription_expires_at = starts_at + timedelta(
            days=SUBSCRIPTION_LENGTH_DAYS
        )
        user.is_verified = True
        user.save(update_fields=("subscription_expires_at", "is_verified"))
        if not was_verified:
            def notify_verified_user():
                try:
                    from notifications.models import Notification
                    from notifications.services import create_notification

                    create_notification(
                        recipient=user,
                        sender=reviewer,
                        notification_type=Notification.NotificationType.VERIFICATION,
                        message="You are verified.",
                    )
                except Exception:
                    logger.exception(
                        "Could not notify user %s after approving payment %s.",
                        user.pk,
                        payment.pk,
                    )

            transaction.on_commit(notify_verified_user)
    else:
        from feed.cache import invalidate_feed

        duration_days = (
            7
            if payment.kind == PaymentRequest.Kind.BOOST_WEEK
            else 30
        )
        post = payment.post
        current_expiry = post.boosted_until
        starts_at = current_expiry if current_expiry and current_expiry > now else now
        post.boosted_until = starts_at + timedelta(days=duration_days)
        post.save(update_fields=("boosted_until",))
        invalidate_feed(post.author_id)

    return payment
