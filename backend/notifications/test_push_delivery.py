from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from firebase_admin import messaging

from notifications.firebase import FirebaseConfigurationError
from notifications.models import Notification, PushDeliveryLog, UserDevice
from notifications.tasks import send_push_notification


User = get_user_model()


class PushDeliveryTaskTests(TestCase):
    def setUp(self):
        self.sender = User.objects.create_user(
            username="push-sender",
            email="push-sender@example.com",
            password="test-password",
        )
        self.recipient = User.objects.create_user(
            username="push-recipient",
            email="push-recipient@example.com",
            password="test-password",
        )
        self.notification = Notification.objects.create(
            recipient=self.recipient,
            sender=self.sender,
            notification_type=Notification.NotificationType.COMMENT,
            message="A new comment.",
            post_id=24,
        )
        self.device = UserDevice.objects.create(
            user=self.recipient,
            token="test-fcm-token",
            platform="android",
        )

    @patch("notifications.tasks.messaging.send")
    @patch("notifications.tasks.get_firebase_app", return_value=object())
    def test_sends_and_records_push_delivery(self, _get_app, send):
        result = send_push_notification.run(self.notification.pk)

        self.assertEqual(result, {"sent": 1, "failed": 0, "skipped": 0})
        delivery = PushDeliveryLog.objects.get(
            notification=self.notification,
            device=self.device,
        )
        self.assertEqual(delivery.status, PushDeliveryLog.Status.SENT)
        self.assertEqual(delivery.attempts, 1)
        self.assertEqual(len(delivery.token_hash), 64)
        self.assertEqual(send.call_args.args[0].data["post_id"], "24")

    @patch("notifications.tasks.messaging.send")
    @patch(
        "notifications.tasks.get_firebase_app",
        side_effect=FirebaseConfigurationError("credentials are missing"),
    )
    def test_missing_credentials_are_recorded_as_failed(self, _get_app, send):
        result = send_push_notification.run(self.notification.pk)

        self.assertEqual(result, {"sent": 0, "failed": 1, "skipped": 0})
        delivery = PushDeliveryLog.objects.get(notification=self.notification)
        self.assertEqual(delivery.status, PushDeliveryLog.Status.FAILED)
        self.assertEqual(delivery.error_code, "firebase_not_configured")
        send.assert_not_called()

    @patch(
        "notifications.tasks.get_firebase_app",
        side_effect=FirebaseConfigurationError("credentials are missing"),
    )
    def test_missing_credentials_do_not_overwrite_prior_success(self, _get_app):
        PushDeliveryLog.objects.create(
            notification=self.notification,
            device=self.device,
            token_hash="a" * 64,
            status=PushDeliveryLog.Status.SENT,
            attempts=1,
        )

        result = send_push_notification.run(self.notification.pk)

        self.assertEqual(result, {"sent": 1, "failed": 0, "skipped": 0})
        delivery = PushDeliveryLog.objects.get(notification=self.notification)
        self.assertEqual(delivery.status, PushDeliveryLog.Status.SENT)

    @patch(
        "notifications.tasks.messaging.send",
        side_effect=messaging.UnregisteredError("unregistered token"),
    )
    @patch("notifications.tasks.get_firebase_app", return_value=object())
    def test_unregistered_tokens_are_removed_and_logged(self, _get_app, _send):
        result = send_push_notification.run(self.notification.pk)

        self.assertEqual(result, {"sent": 0, "failed": 1, "skipped": 0})
        self.assertFalse(UserDevice.objects.filter(pk=self.device.pk).exists())
        delivery = PushDeliveryLog.objects.get(notification=self.notification)
        self.assertIsNone(delivery.device)
        self.assertEqual(delivery.error_code, "unregistered")


class NotificationPushEnqueueTests(TestCase):
    def setUp(self):
        self.sender = User.objects.create_user(
            username="enqueue-sender",
            email="enqueue-sender@example.com",
            password="test-password",
        )
        self.recipient = User.objects.create_user(
            username="enqueue-recipient",
            email="enqueue-recipient@example.com",
            password="test-password",
        )

    @patch("notifications.tasks.send_push_notification.delay")
    def test_push_is_enqueued_after_notification_commit(self, delay):
        from notifications.services import create_notification

        with self.captureOnCommitCallbacks(execute=True):
            notification = create_notification(
                recipient=self.recipient,
                sender=self.sender,
                notification_type=Notification.NotificationType.FRIEND_REQUEST,
                message="A new friend request.",
            )

        delay.assert_called_once_with(notification.pk)
