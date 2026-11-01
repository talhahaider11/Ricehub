from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from messaging.models import Conversation


User = get_user_model()


class MessageVerificationWarningTests(APITestCase):
    def setUp(self):
        self.unverified_sender = User.objects.create_user(
            username="unverified-sender",
            email="sender@example.com",
            password="StrongPassword123",
            is_email_verified=False,
        )
        self.verified_recipient = User.objects.create_user(
            username="verified-recipient",
            email="recipient@example.com",
            password="StrongPassword123",
            is_email_verified=True,
        )
        self.conversation = Conversation.objects.create()
        self.conversation.participants.add(
            self.unverified_sender,
            self.verified_recipient,
        )

    def test_unverified_sender_warning_is_returned_to_both_members(self):
        self.client.force_authenticate(self.unverified_sender)
        created = self.client.post(
            f"/api/messages/conversations/{self.conversation.pk}/messages/",
            {"content": "Hello"},
            format="json",
        )

        self.assertEqual(created.status_code, 201)
        self.assertTrue(created.data["verification_warning"])

        self.client.force_authenticate(self.verified_recipient)
        history = self.client.get(
            f"/api/messages/conversations/{self.conversation.pk}/messages/"
        )

        self.assertEqual(history.status_code, 200)
        self.assertTrue(history.data["results"][0]["verification_warning"])
        self.assertFalse(
            history.data["results"][0]["sender"]["is_email_verified"]
        )

    def test_verified_sender_does_not_trigger_warning(self):
        self.verified_recipient.is_email_verified = False
        self.verified_recipient.save(update_fields=["is_email_verified"])
        self.unverified_sender.is_email_verified = True
        self.unverified_sender.save(update_fields=["is_email_verified"])
        self.client.force_authenticate(self.unverified_sender)

        response = self.client.post(
            f"/api/messages/conversations/{self.conversation.pk}/messages/",
            {"content": "Hello"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.data["verification_warning"])
