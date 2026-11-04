import hashlib
import logging

from celery import shared_task
from firebase_admin import messaging
from firebase_admin.exceptions import FirebaseError

from .firebase import FirebaseConfigurationError, get_firebase_app
from .models import Notification, PushDeliveryLog, UserDevice


logger = logging.getLogger(__name__)


def _record_failure(notification, device, error_code):
    delivery, _ = PushDeliveryLog.objects.get_or_create(
        notification=notification,
        device=device,
        defaults={
            "token_hash": hashlib.sha256(device.token.encode("utf-8")).hexdigest(),
        },
    )
    delivery.attempts += 1
    delivery.status = PushDeliveryLog.Status.FAILED
    delivery.error_code = error_code[:100]
    delivery.save(update_fields=["attempts", "status", "error_code", "updated_at"])


def _build_message(notification, device):
    data = {
        "notification_id": str(notification.pk),
        "notification_type": notification.notification_type,
    }
    if notification.sender_id:
        data["sender_id"] = str(notification.sender_id)
    for field in ("post_id", "comment_id", "conversation_id"):
        value = getattr(notification, field)
        if value is not None:
            data[field] = str(value)

    return messaging.Message(
        token=device.token,
        notification=messaging.Notification(
            title=f"RiceHub · {notification.get_notification_type_display()}",
            body=notification.message,
        ),
        data=data,
        android=messaging.AndroidConfig(
            priority="high",
            notification=messaging.AndroidNotification(
                channel_id="ricehub_notifications",
                sound="default",
            ),
        ),
        apns=messaging.APNSConfig(
            payload=messaging.APNSPayload(
                aps=messaging.Aps(sound="default"),
            ),
        ),
    )


@shared_task(bind=True, max_retries=3)
def send_push_notification(self, notification_id):
    notification = (
        Notification.objects
        .select_related("sender")
        .filter(pk=notification_id)
        .first()
    )
    if notification is None:
        logger.warning(
            "Push skipped because notification %s no longer exists.",
            notification_id,
        )
        return {"sent": 0, "failed": 0, "skipped": 1}

    devices = list(
        UserDevice.objects
        .filter(user_id=notification.recipient_id)
        .only("id", "token")
    )
    if not devices:
        return {"sent": 0, "failed": 0, "skipped": 1}

    try:
        app = get_firebase_app()
    except FirebaseConfigurationError as exc:
        logger.error("Firebase push is not configured: %s", exc)
        failed = 0
        for device in devices:
            previous_delivery = PushDeliveryLog.objects.filter(
                notification=notification,
                device=device,
            ).first()
            if (
                previous_delivery
                and previous_delivery.status == PushDeliveryLog.Status.SENT
            ):
                continue
            _record_failure(notification, device, "firebase_not_configured")
            failed += 1
        return {
            "sent": len(devices) - failed,
            "failed": failed,
            "skipped": 0,
        }

    sent = 0
    failed = 0
    retry_error = None

    for device in devices:
        delivery, _ = PushDeliveryLog.objects.get_or_create(
            notification=notification,
            device=device,
            defaults={
                "token_hash": hashlib.sha256(
                    device.token.encode("utf-8")
                ).hexdigest(),
            },
        )
        if delivery.status == PushDeliveryLog.Status.SENT:
            sent += 1
            continue

        delivery.attempts += 1
        delivery.status = PushDeliveryLog.Status.PENDING
        delivery.error_code = ""
        delivery.save(
            update_fields=["attempts", "status", "error_code", "updated_at"]
        )

        try:
            messaging.send(_build_message(notification, device), app=app)
        except messaging.UnregisteredError:
            UserDevice.objects.filter(
                pk=device.pk,
                token=device.token,
            ).delete()
            delivery.device = None
            delivery.status = PushDeliveryLog.Status.FAILED
            delivery.error_code = "unregistered"
            delivery.save(
                update_fields=["device", "status", "error_code", "updated_at"]
            )
            failed += 1
            continue
        except FirebaseError as exc:
            delivery.status = PushDeliveryLog.Status.FAILED
            delivery.error_code = str(
                getattr(exc, "code", "") or type(exc).__name__
            )[:100]
            delivery.save(
                update_fields=["status", "error_code", "updated_at"]
            )
            logger.warning(
                "Firebase delivery failed for notification %s, device %s (%s).",
                notification.pk,
                device.pk,
                delivery.error_code,
            )
            retry_error = retry_error or exc
            failed += 1
            continue

        delivery.status = PushDeliveryLog.Status.SENT
        delivery.error_code = ""
        delivery.save(
            update_fields=["status", "error_code", "updated_at"]
        )
        sent += 1

    if retry_error is not None:
        raise self.retry(
            exc=retry_error,
            countdown=min(60, 2 ** (self.request.retries + 1)),
        )

    return {"sent": sent, "failed": failed, "skipped": 0}
