from django.contrib.auth import get_user_model

from rest_framework.test import APITestCase

from messaging.models import Conversation

User = get_user_model()


class MessageTests(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username="john",
            email="john@example.com",
            password="StrongPassword123!",
        )

        self.friend = User.objects.create_user(
            username="jane",
            email="jane@example.com",
            password="StrongPassword123!",
        )

        self.conversation = (
            Conversation.objects.create()
        )

        self.conversation.participants.add(
            self.user,
            self.friend,
        )

    def test_user_can_send_message(self):
        self.client.force_authenticate(
            user=self.user
        )

        response = self.client.post(
            f"/api/messages/conversations/"
            f"{self.conversation.id}/messages/",
            {
                "content": "Hello Jane!"
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            201,
        )