from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from users.models import PhoneVerification
from users.models import UserPrivacySettings


User = get_user_model()


class PhoneVerificationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="phone-user",
            email="phone@example.com",
            password="phone-test-password",
        )
        self.client.force_authenticate(self.user)

    @patch("users.views.send_sms")
    def test_sms_otp_verifies_e164_phone_number(self, send_sms):
        response = self.client.post(
            "/api/users/phone/verification/",
            {"action": "send", "phone_number": "+923001234567"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(send_sms.called)
        sent_message = send_sms.call_args.args[1]
        code = sent_message.rsplit(" ", 1)[-1].rstrip(".")

        response = self.client.post(
            "/api/users/phone/verification/",
            {
                "action": "verify",
                "phone_number": "+923001234567",
                "code": code,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_phone_verified)
        self.assertEqual(self.user.phone_number, "+923001234567")
        self.assertFalse(PhoneVerification.objects.filter(user=self.user).exists())

    def test_phone_number_must_use_international_format(self):
        response = self.client.post(
            "/api/users/phone/verification/",
            {"action": "send", "phone_number": "03001234567"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(PhoneVerification.objects.filter(user=self.user).exists())

    def test_contact_suggestions_only_return_opted_in_verified_accounts(self):
        discoverable = User.objects.create_user(
            username="discoverable",
            email="discoverable@example.com",
            password="phone-test-password",
            phone_number="+923001234567",
            is_phone_verified=True,
        )
        hidden = User.objects.create_user(
            username="hidden-contact",
            email="hidden-contact@example.com",
            password="phone-test-password",
            phone_number="+923001234568",
            is_phone_verified=True,
        )
        UserPrivacySettings.objects.create(
            user=discoverable,
            discoverable_by_phone=True,
        )
        UserPrivacySettings.objects.create(
            user=hidden,
            discoverable_by_phone=False,
        )

        response = self.client.post(
            "/api/users/suggestions/contacts/",
            {
                "phone_numbers": [
                    "+923001234567",
                    "+923001234568",
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.data], [discoverable.pk])
        self.assertIsNone(response.data[0]["phone_number"])
