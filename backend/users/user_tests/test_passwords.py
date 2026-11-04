from urllib.parse import parse_qs, urlparse

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from django.contrib.auth.tokens import default_token_generator
from users.models import SecurityEvent


User = get_user_model()


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    DEFAULT_FROM_EMAIL="noreply@ricehub.test",
    FRONTEND_URL="https://ricehub.test/",
)
class PasswordFlowTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            username="password-user",
            email="password@example.com",
            password="OriginalPassword123",
        )

    def test_password_reset_request_is_generic_and_emails_existing_account(self):
        response = self.client.post(
            "/api/users/password-reset/",
            {"email": self.user.email},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["message"],
            "If an account exists for this email, password reset instructions will be sent.",
        )
        self.assertEqual(len(mail.outbox), 1)
        reset_url = mail.outbox[0].body.splitlines()[-1]
        parsed_url = urlparse(reset_url)
        self.assertEqual(parsed_url.scheme, "https")
        self.assertEqual(parsed_url.netloc, "ricehub.test")
        self.assertEqual(parsed_url.path, "/forgot-password/")
        self.assertTrue(parse_qs(parsed_url.query).get("uid"))
        self.assertTrue(parse_qs(parsed_url.query).get("token"))

    def test_password_reset_request_does_not_disclose_unknown_email(self):
        response = self.client.post(
            "/api/users/password-reset/",
            {"email": "unknown@example.com"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["message"],
            "If an account exists for this email, password reset instructions will be sent.",
        )
        self.assertEqual(mail.outbox, [])

    def test_reset_link_changes_password_once_and_revokes_refresh_tokens(self):
        refresh = RefreshToken.for_user(self.user)
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)
        payload = {
            "uid": uid,
            "token": token,
            "password": "N3wRiverStone58",
        }

        response = self.client.post(
            "/api/users/password-reset/confirm/",
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("N3wRiverStone58"))
        self.assertFalse(self.user.check_password("OriginalPassword123"))
        self.assertTrue(
            SecurityEvent.objects.filter(
                user=self.user,
                event_type=SecurityEvent.EventType.PASSWORD_CHANGED,
            ).exists()
        )

        reused_link = self.client.post(
            "/api/users/password-reset/confirm/",
            payload,
            format="json",
        )
        self.assertEqual(reused_link.status_code, status.HTTP_400_BAD_REQUEST)

        refresh_response = self.client.post(
            "/api/token/refresh/",
            {"refresh": str(refresh)},
            format="json",
        )
        self.assertEqual(refresh_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_reset_link_rejects_invalid_token_and_weak_password(self):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)

        invalid_token = self.client.post(
            "/api/users/password-reset/confirm/",
            {"uid": uid, "token": "invalid", "password": "N3wRiverStone58"},
            format="json",
        )
        weak_password = self.client.post(
            "/api/users/password-reset/confirm/",
            {"uid": uid, "token": token, "password": "weak"},
            format="json",
        )

        self.assertEqual(invalid_token.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(weak_password.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("OriginalPassword123"))

    def test_change_password_requires_authentication_and_current_password(self):
        url = "/api/users/password/change/"
        payload = {
            "current_password": "OriginalPassword123",
            "new_password": "N3wRiverStone58",
        }

        unauthenticated = self.client.post(url, payload, format="json")
        self.assertEqual(unauthenticated.status_code, status.HTTP_401_UNAUTHORIZED)

        self.client.force_authenticate(self.user)
        wrong_current = self.client.post(
            url,
            {**payload, "current_password": "incorrect"},
            format="json",
        )
        weak_new = self.client.post(
            url,
            {**payload, "new_password": "weak"},
            format="json",
        )

        self.assertEqual(wrong_current.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(weak_new.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("OriginalPassword123"))

    def test_change_password_updates_password_and_revokes_refresh_tokens(self):
        refresh = RefreshToken.for_user(self.user)
        self.client.force_authenticate(self.user)

        response = self.client.post(
            "/api/users/password/change/",
            {
                "current_password": "OriginalPassword123",
                "new_password": "N3wRiverStone58",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("N3wRiverStone58"))
        self.assertFalse(self.user.check_password("OriginalPassword123"))

        refresh_response = self.client.post(
            "/api/token/refresh/",
            {"refresh": str(refresh)},
            format="json",
        )
        self.assertEqual(refresh_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_change_password_rejects_reusing_current_password(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(
            "/api/users/password/change/",
            {
                "current_password": "OriginalPassword123",
                "new_password": "OriginalPassword123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("OriginalPassword123"))
