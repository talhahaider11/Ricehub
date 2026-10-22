from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from notifications.models import Notification, NotificationPreference, UserDevice
from notifications.services import create_notification


User = get_user_model()


class NotificationPreferenceTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="settings-user",
            email="settings@example.com",
            password="StrongPassword123",
        )

    def test_preferences_can_be_loaded_and_updated(self):
        self.client.force_authenticate(self.user)
        response = self.client.get("/api/notifications/preferences/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["comments"])

        response = self.client.patch(
            "/api/notifications/preferences/",
            {"comments": False},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["comments"])

    def test_disabled_preference_suppresses_notification(self):
        sender = User.objects.create_user(
            username="commenter",
            email="commenter@example.com",
            password="StrongPassword123",
        )
        NotificationPreference.objects.create(
            user=self.user,
            comments=False,
        )

        result = create_notification(
            recipient=self.user,
            sender=sender,
            notification_type=Notification.NotificationType.COMMENT,
            message="A new comment.",
        )

        self.assertIsNone(result)
        self.assertFalse(Notification.objects.filter(recipient=self.user).exists())


class PushDeviceApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="push-device-user",
            email="push-device@example.com",
            password="SafeTestPassword!123",
        )
        self.other_user = User.objects.create_user(
            username="other-push-user",
            email="other-push@example.com",
            password="SafeTestPassword!456",
        )
        self.client.force_authenticate(self.user)
        self.token = "fcm-device-token-value"

    def test_authenticated_user_can_register_and_remove_their_device(self):
        registered = self.client.post(
            "/api/notifications/devices/",
            {"token": self.token, "platform": "android"},
            format="json",
        )

        self.assertEqual(registered.status_code, 200)
        self.assertEqual(registered.data["token"], self.token)
        self.assertEqual(UserDevice.objects.get().user, self.user)

        removed = self.client.delete(
            "/api/notifications/devices/",
            {"token": self.token},
            format="json",
        )

        self.assertEqual(removed.status_code, 204)
        self.assertFalse(UserDevice.objects.exists())

    def test_device_registration_reassigns_existing_token_to_current_user(self):
        UserDevice.objects.create(
            user=self.other_user,
            token=self.token,
            platform="android",
        )

        response = self.client.post(
            "/api/notifications/devices/",
            {"token": self.token, "platform": "android"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(UserDevice.objects.get().user, self.user)

    def test_user_cannot_unregister_another_users_device(self):
        UserDevice.objects.create(
            user=self.other_user,
            token=self.token,
            platform="android",
        )

        response = self.client.delete(
            "/api/notifications/devices/",
            {"token": self.token},
            format="json",
        )

        self.assertEqual(response.status_code, 204)
        self.assertEqual(UserDevice.objects.get().user, self.other_user)

    def test_device_token_must_not_be_blank(self):
        response = self.client.post(
            "/api/notifications/devices/",
            {"token": "   ", "platform": "android"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_master_notification_setting_suppresses_every_category(self):
        sender = User.objects.create_user(
            username="message-sender",
            email="message-sender@example.com",
            password="StrongPassword123",
        )
        NotificationPreference.objects.create(
            user=self.user,
            all_notifications=False,
        )

        result = create_notification(
            recipient=self.user,
            sender=sender,
            notification_type=Notification.NotificationType.MESSAGE,
            message="A new message.",
        )

        self.assertIsNone(result)
        self.assertFalse(Notification.objects.filter(recipient=self.user).exists())
