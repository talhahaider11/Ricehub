from asgiref.sync import async_to_sync
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework_simplejwt.tokens import AccessToken

from .middleware import get_user_from_token


User = get_user_model()


class SuspendedWebSocketAuthenticationTests(TestCase):
    def test_inactive_or_suspended_users_cannot_authenticate_websockets(self):
        user = User.objects.create_user(
            username="websocket-suspension",
            email="websocket-suspension@example.com",
            password="Secure-test-password-2026!",
        )
        token = str(AccessToken.for_user(user))

        self.assertEqual(async_to_sync(get_user_from_token)(token), user)

        user.is_active = False
        user.is_suspended = True
        user.save(update_fields=["is_active", "is_suspended"])

        self.assertIsNone(async_to_sync(get_user_from_token)(token))
