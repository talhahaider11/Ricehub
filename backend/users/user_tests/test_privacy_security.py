import re

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core import mail
from django.test import override_settings
from rest_framework.test import APITestCase

from messaging.models import Conversation, Message
from users.models import UserPrivacySettings, UserSecuritySettings


User = get_user_model()


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    DEFAULT_FROM_EMAIL="noreply@ricehub.test",
)
class PrivacyAndSecurityTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            username="privacy-user",
            email="privacy@example.com",
            password="StrongPassword123",
        )
        self.other = User.objects.create_user(
            username="other-user",
            email="other@example.com",
            password="StrongPassword123",
        )

    def test_profile_email_is_only_visible_to_its_owner(self):
        self.client.force_authenticate(self.user)

        own_profile = self.client.get("/api/users/me/")
        other_profile = self.client.get(f"/api/users/{self.other.id}/")

        self.assertEqual(own_profile.data["email"], self.user.email)
        self.assertIsNone(other_profile.data["email"])

    def test_friend_request_and_message_privacy_are_enforced(self):
        UserPrivacySettings.objects.create(
            user=self.other,
            friend_requests_from=UserPrivacySettings.Audience.NOBODY,
            messages_from=UserPrivacySettings.MessageAudience.NOBODY,
        )
        self.client.force_authenticate(self.user)

        friend_response = self.client.post(
            "/api/friends/requests/",
            {"user_id": self.other.id},
            format="json",
        )
        message_response = self.client.post(
            "/api/messages/conversations/",
            {"username": self.other.username},
            format="json",
        )

        self.assertEqual(friend_response.status_code, 403)
        self.assertEqual(message_response.status_code, 403)

    def test_blocked_user_cannot_view_search_or_contact_blocker(self):
        self.client.force_authenticate(self.user)
        blocked = self.client.post(
            "/api/users/blocked-users/",
            {"username": self.other.username},
            format="json",
        )
        self.assertEqual(blocked.status_code, 201)

        self.client.force_authenticate(self.other)
        profile = self.client.get(f"/api/users/{self.user.id}/")
        search = self.client.get("/api/users/search/", {"q": self.user.username})
        friend_request = self.client.post(
            "/api/friends/requests/",
            {"user_id": self.user.id},
            format="json",
        )
        conversation = self.client.post(
            "/api/messages/conversations/",
            {"username": self.user.username},
            format="json",
        )

        self.assertEqual(profile.status_code, 403)
        self.assertEqual(search.data["results"], [])
        self.assertEqual(friend_request.status_code, 403)
        self.assertEqual(conversation.status_code, 403)

    def test_email_search_requires_opt_in(self):
        self.client.force_authenticate(self.user)
        hidden = self.client.get(
            "/api/users/search/",
            {"q": self.other.email},
        )
        self.assertEqual(hidden.data["results"], [])

        UserPrivacySettings.objects.create(
            user=self.other,
            discoverable_by_email=True,
        )
        visible = self.client.get(
            "/api/users/search/",
            {"q": self.other.email},
        )
        self.assertEqual([item["id"] for item in visible.data["results"]], [self.other.id])
        self.assertIsNone(visible.data["results"][0]["email"])

    def test_privacy_controls_can_be_saved(self):
        self.client.force_authenticate(self.user)
        response = self.client.patch(
            "/api/users/privacy/",
            {
                "friend_requests_from": "friends_of_friends",
                "messages_from": "friends",
                "discoverable_by_email": True,
                "show_activity_status": False,
                "show_last_seen": False,
                "read_receipts": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["show_activity_status"])
        self.assertFalse(response.data["read_receipts"])
        self.assertEqual(response.data["messages_from"], "friends")

    def test_disabling_read_receipts_keeps_incoming_messages_unread(self):
        conversation = Conversation.objects.create()
        conversation.participants.add(self.user, self.other)
        message = Message.objects.create(
            conversation=conversation,
            sender=self.other,
            content="Hello",
        )
        UserPrivacySettings.objects.create(
            user=self.user,
            read_receipts=False,
        )
        self.client.force_authenticate(self.user)

        response = self.client.post(
            f"/api/messages/conversations/{conversation.id}/read/",
        )

        self.assertEqual(response.status_code, 200)
        message.refresh_from_db()
        self.assertFalse(message.is_read)

    def test_enabled_read_receipts_return_ids_for_live_seen_updates(self):
        conversation = Conversation.objects.create()
        conversation.participants.add(self.user, self.other)
        message = Message.objects.create(
            conversation=conversation,
            sender=self.other,
            content="Read me",
        )
        self.client.force_authenticate(self.user)

        response = self.client.post(
            f"/api/messages/conversations/{conversation.id}/read/",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["read_receipts_enabled"])
        self.assertEqual(response.data["message_ids"], [message.id])
        message.refresh_from_db()
        self.assertTrue(message.is_read)

    def test_user_can_unblock_an_account(self):
        self.client.force_authenticate(self.user)
        self.client.post(
            "/api/users/blocked-users/",
            {"user_id": self.other.id},
            format="json",
        )

        response = self.client.delete(
            f"/api/users/blocked-users/{self.other.id}/"
        )

        self.assertEqual(response.status_code, 204)
        self.assertFalse(self.user.blocked_users.exists())

    def test_account_export_and_password_confirmed_deletion(self):
        self.client.force_authenticate(self.user)
        export = self.client.get("/api/users/account/export/")
        self.assertEqual(export.status_code, 200)
        self.assertEqual(export.data["account"]["email"], self.user.email)

        denied = self.client.post(
            "/api/users/account/delete/",
            {"password": "StrongPassword123", "confirmation": "wrong"},
            format="json",
        )
        self.assertEqual(denied.status_code, 400)
        self.assertTrue(User.objects.filter(pk=self.user.pk).exists())

        deleted = self.client.post(
            "/api/users/account/delete/",
            {"password": "StrongPassword123", "confirmation": "DELETE"},
            format="json",
        )
        self.assertEqual(deleted.status_code, 200)
        self.assertFalse(User.objects.filter(pk=self.user.pk).exists())

    def test_two_factor_login_requires_email_code_before_issuing_tokens(self):
        UserSecuritySettings.objects.create(
            user=self.user,
            two_factor_enabled=True,
        )
        login = self.client.post(
            "/api/token/",
            {"username": self.user.username, "password": "StrongPassword123"},
            format="json",
        )
        self.assertEqual(login.status_code, 200)
        self.assertTrue(login.data["two_factor_required"])
        self.assertNotIn("access", login.data)
        self.assertEqual(len(mail.outbox), 1)

        code = re.search(r"\b(\d{6})\b", mail.outbox[0].body).group(1)
        verified = self.client.post(
            "/api/users/verify-two-factor/",
            {"username": self.user.username, "code": code},
            format="json",
        )
        self.assertEqual(verified.status_code, 200)
        self.assertIn("access", verified.data)
        self.assertIn("refresh", verified.data)

    def test_two_factor_can_only_be_enabled_after_email_code(self):
        self.client.force_authenticate(self.user)
        start = self.client.post(
            "/api/users/security/two-factor/",
            {
                "action": "start_enable",
                "password": "StrongPassword123",
            },
            format="json",
        )
        self.assertEqual(start.status_code, 200)

        code = re.search(r"\b(\d{6})\b", mail.outbox[0].body).group(1)
        confirm = self.client.post(
            "/api/users/security/two-factor/",
            {
                "action": "confirm_enable",
                "password": "StrongPassword123",
                "code": code,
            },
            format="json",
        )
        self.assertEqual(confirm.status_code, 200)
        self.assertTrue(confirm.data["two_factor_enabled"])
