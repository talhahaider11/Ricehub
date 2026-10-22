import re

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import override_settings
from rest_framework.test import APITestCase

from users.models import EmailVerification


User = get_user_model()


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    DEFAULT_FROM_EMAIL="noreply@ricehub.test",
)
class EmailVerificationTests(APITestCase):
    def register(self, username="verify-user", email="verify@example.com"):
        return self.client.post(
            "/api/users/register/",
            {
                "username": username,
                "email": email,
                "password": "StrongPassword123",
            },
            format="json",
        )

    def test_registration_requires_email_code_before_login(self):
        response = self.register()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(mail.outbox), 1)

        user = User.objects.get(username="verify-user")
        self.assertFalse(user.is_email_verified)
        self.assertEqual(
            self.client.post(
                "/api/token/",
                {"username": user.username, "password": "StrongPassword123"},
                format="json",
            ).status_code,
            401,
        )

        code = re.search(r"\b(\d{6})\b", mail.outbox[0].body).group(1)
        verified = self.client.post(
            "/api/users/verify-email/",
            {"email": user.email, "code": code},
            format="json",
        )
        self.assertEqual(verified.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.is_email_verified)
        self.assertFalse(EmailVerification.objects.filter(user=user).exists())

        login = self.client.post(
            "/api/token/",
            {"username": user.username, "password": "StrongPassword123"},
            format="json",
        )
        self.assertEqual(login.status_code, 200)
        self.assertIn("access", login.data)

    def test_invalid_code_is_rejected_and_counted(self):
        self.register()
        user = User.objects.get(username="verify-user")
        response = self.client.post(
            "/api/users/verify-email/",
            {"email": user.email, "code": "000000"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(user.email_verification.attempts, 1)

    def test_expired_code_is_rejected(self):
        self.register()
        user = User.objects.get(username="verify-user")
        verification = user.email_verification
        verification.expires_at = verification.expires_at.replace(year=2000)
        verification.save(update_fields=["expires_at"])
        code = re.search(r"\b(\d{6})\b", mail.outbox[0].body).group(1)

        response = self.client.post(
            "/api/users/verify-email/",
            {"email": user.email, "code": code},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_duplicate_email_is_case_insensitive(self):
        User.objects.create_user(
            username="existing",
            email="person@example.com",
            password="StrongPassword123",
        )
        response = self.register(
            username="another-user",
            email="PERSON@example.com",
        )
        self.assertEqual(response.status_code, 400)
