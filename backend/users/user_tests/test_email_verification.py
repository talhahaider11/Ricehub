import re

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import override_settings
from rest_framework.test import APITestCase

from users.models import EmailVerification
from users.verification import send_verification_code


User = get_user_model()


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    DEFAULT_FROM_EMAIL="noreply@ricehub.test",
)
class EmailVerificationTests(APITestCase):
    def create_unverified_user(
        self,
        username="verify-user",
        email="verify@example.com",
        is_active=False,
    ):
        user = User.objects.create_user(
            username=username,
            email=email,
            password="StrongPassword123",
            is_active=is_active,
            is_email_verified=False,
        )
        verification = EmailVerification.objects.create(user=user)
        send_verification_code(user, verification)
        return user

    def test_active_account_can_verify_email_later(self):
        user = User.objects.create_user(
            username="verify-user",
            email="verify@example.com",
            password="StrongPassword123",
            is_active=True,
            is_email_verified=False,
        )
        response = self.client.post(
            "/api/users/resend-verification/",
            {"email": user.email},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)

        code = re.search(r"\b(\d{6})\b", mail.outbox[0].body).group(1)
        verified = self.client.post(
            "/api/users/verify-email/",
            {"email": user.email, "code": code},
            format="json",
        )
        self.assertEqual(verified.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.is_email_verified)
        self.assertTrue(user.is_active)
        self.assertFalse(EmailVerification.objects.filter(user=user).exists())

    def test_invalid_code_is_rejected_and_counted(self):
        user = self.create_unverified_user()
        response = self.client.post(
            "/api/users/verify-email/",
            {"email": user.email, "code": "000000"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        user.email_verification.refresh_from_db()
        self.assertEqual(user.email_verification.attempts, 1)

    def test_expired_code_is_rejected(self):
        user = self.create_unverified_user()
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
        response = self.client.post(
            "/api/users/register/",
            {
                "username": "another-user",
                "email": "PERSON@example.com",
                "password": "StrongPassword123",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
