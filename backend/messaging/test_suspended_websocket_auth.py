from unittest.mock import AsyncMock, patch
from urllib.parse import quote

from asgiref.sync import async_to_sync
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.test import TestCase
from rest_framework_simplejwt.tokens import AccessToken

from .consumers import CallSignalingConsumer
from .middleware import JWTAuthMiddleware, get_user_from_token


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

    def test_middleware_parses_and_authenticates_the_token_query_parameter(self):
        user = User.objects.create_user(
            username="websocket-query-token",
            email="websocket-query-token@example.com",
            password="Secure-test-password-2026!",
        )
        token = str(AccessToken.for_user(user))
        captured_scopes = []

        async def inner_app(scope, receive, send):
            captured_scopes.append(scope)

        middleware = JWTAuthMiddleware(inner_app)
        async_to_sync(middleware)(
            {
                "type": "websocket",
                "query_string": f"token={quote(token, safe='')}".encode(),
            },
            AsyncMock(),
            AsyncMock(),
        )

        self.assertEqual(captured_scopes[0]["user"], user)
        self.assertIsNone(captured_scopes[0]["jwt_auth_error"])

    def test_signaling_consumer_logs_the_authentication_rejection_reason(self):
        consumer = CallSignalingConsumer()
        consumer.scope = {
            "user": AnonymousUser(),
            "jwt_auth_error": "JWT validation failed: Token is expired",
        }
        consumer.close = AsyncMock()

        with patch("messaging.consumers.logger.warning") as log_warning:
            async_to_sync(consumer.connect)()

        log_warning.assert_called_once_with(
            "Rejecting call signaling WebSocket connection: %s",
            "JWT validation failed: Token is expired",
        )
        consumer.close.assert_awaited_once_with(code=4001)
