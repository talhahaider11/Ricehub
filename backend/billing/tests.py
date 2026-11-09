from datetime import timedelta
from io import BytesIO
from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from PIL import Image
from rest_framework.test import APITestCase

from billing.models import PaymentRequest
from billing.services import review_payment_request
from billing.tasks import expire_verification_subscriptions
from notifications.models import Notification
from posts.models import Post


User = get_user_model()


class BillingTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="billing-user",
            email="billing@example.com",
            password="billing-test-password",
            is_email_verified=True,
        )
        self.staff = User.objects.create_user(
            username="billing-staff",
            email="staff@example.com",
            password="billing-test-password",
            is_staff=True,
        )
        self.client.force_authenticate(self.user)

    def test_billing_options_keep_automatic_charges_disabled(self):
        response = self.client.get("/api/billing/options/")

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["automatic_billing"])
        self.assertEqual(response.data["subscription"]["amount_pkr"], "249.00")
        self.assertEqual(response.data["subscription"]["grace_days"], 5)
        self.assertIn("account_number", response.data["sadapay"])
        self.assertEqual(response.data["review_window_hours"], 24)

    def create_receipt(self):
        image_buffer = BytesIO()
        Image.new("RGB", (1, 1), color="white").save(image_buffer, format="PNG")
        return SimpleUploadedFile(
            "receipt.png",
            image_buffer.getvalue(),
            content_type="image/png",
        )

    @patch(
        "notifications.services.async_to_sync",
        return_value=Mock(side_effect=RuntimeError("channel unavailable")),
    )
    def test_subscription_payment_is_manual_and_server_priced(
        self,
        async_to_sync,
    ):
        response = self.client.post(
            "/api/billing/payment-requests/",
            {
                "kind": PaymentRequest.Kind.SUBSCRIPTION,
                "method": PaymentRequest.Method.SADAPAY,
                "amount_pkr": "1.00",
                "reference": "transfer-123",
                "sender_name": "Billing User",
                "transfer_app": PaymentRequest.TransferApp.EASYPAISA,
                "receipt": self.create_receipt(),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["amount_pkr"], "249.00")
        self.assertEqual(response.data["status"], PaymentRequest.Status.PENDING)
        self.assertEqual(response.data["sender_name"], "Billing User")
        self.assertEqual(response.data["transfer_app"], "easypaisa")
        self.assertNotIn("receipt", response.data)
        self.assertFalse(self.user.is_verified)

        payment = PaymentRequest.objects.get(pk=response.data["id"])
        review_payment_request(payment.pk, self.staff, approved=True)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_verified)
        notification = Notification.objects.get(
            recipient=self.user,
            notification_type=Notification.NotificationType.VERIFICATION,
        )
        self.assertEqual(notification.message, "You are verified.")
        async_to_sync.assert_called_once()
        self.assertGreater(
            self.user.subscription_expires_at,
            timezone.now() + timedelta(days=29),
        )

    def test_subscription_requires_sender_details_and_receipt(self):
        response = self.client.post(
            "/api/billing/payment-requests/",
            {
                "kind": PaymentRequest.Kind.SUBSCRIPTION,
                "method": PaymentRequest.Method.SADAPAY,
                "reference": "missing-receipt",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("receipt", response.data)
        self.assertFalse(PaymentRequest.objects.exists())

    def test_subscription_rejects_non_sadapay_destination(self):
        response = self.client.post(
            "/api/billing/payment-requests/",
            {
                "kind": PaymentRequest.Kind.SUBSCRIPTION,
                "method": PaymentRequest.Method.EASYPAISA,
                "reference": "wrong-destination",
                "sender_name": "Billing User",
                "transfer_app": PaymentRequest.TransferApp.EASYPAISA,
                "receipt": self.create_receipt(),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("method", response.data)
        self.assertFalse(PaymentRequest.objects.exists())

    def test_receipt_download_is_limited_to_staff(self):
        payment = PaymentRequest.objects.create(
            user=self.user,
            kind=PaymentRequest.Kind.SUBSCRIPTION,
            method=PaymentRequest.Method.SADAPAY,
            amount_pkr=PaymentRequest.PRICES[PaymentRequest.Kind.SUBSCRIPTION],
            reference="private-receipt",
            receipt=self.create_receipt(),
        )
        receipt_url = f"/api/billing/admin/payment-requests/{payment.pk}/receipt/"

        forbidden = self.client.get(receipt_url)
        self.assertEqual(forbidden.status_code, 403)

        self.client.force_authenticate(self.staff)
        allowed = self.client.get(receipt_url)
        self.assertEqual(allowed.status_code, 200)
        self.assertTrue(allowed["Content-Type"].startswith("image/"))

    def test_subscription_requires_email_verification(self):
        self.user.is_email_verified = False
        self.user.save(update_fields=("is_email_verified",))

        response = self.client.post(
            "/api/billing/payment-requests/",
            {
                "kind": PaymentRequest.Kind.SUBSCRIPTION,
                "method": PaymentRequest.Method.SADAPAY,
                "reference": "transfer-123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(PaymentRequest.objects.exists())

    def test_boost_request_uses_fixed_price_and_approves_post_boost(self):
        post = Post.objects.create(author=self.user, content="Rice crop update")
        response = self.client.post(
            "/api/billing/payment-requests/",
            {
                "kind": PaymentRequest.Kind.BOOST_MONTH,
                "method": PaymentRequest.Method.EASYPAISA,
                "reference": "boost-transfer",
                "post": post.pk,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["amount_pkr"], "350.00")
        payment = PaymentRequest.objects.get(pk=response.data["id"])
        review_payment_request(payment.pk, self.staff, approved=True)
        post.refresh_from_db()
        self.assertGreater(
            post.boosted_until,
            timezone.now() + timedelta(days=29),
        )

    def test_expired_accounts_remain_verified_during_five_day_grace(self):
        self.user.is_verified = True
        self.user.subscription_expires_at = timezone.now() - timedelta(days=4)
        self.user.save(update_fields=("is_verified", "subscription_expires_at"))

        self.assertEqual(expire_verification_subscriptions.run(), 0)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_verified)

        self.user.subscription_expires_at = timezone.now() - timedelta(days=6)
        self.user.save(update_fields=("subscription_expires_at",))
        self.assertEqual(expire_verification_subscriptions.run(), 1)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_verified)
