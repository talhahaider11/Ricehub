from decimal import Decimal

from django.contrib import admin
from django.contrib.auth import get_user_model
from django.test import RequestFactory, TestCase

from billing.admin import PaymentRequestAdmin
from billing.models import PaymentRequest


User = get_user_model()


class PaymentAdminRowNumberingTests(TestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            username="payment-admin",
            email="payment-admin@example.com",
            password="test-password",
        )
        self.member = User.objects.create_user(
            username="payment-member",
            email="payment-member@example.com",
            password="test-password",
        )
        self.request_factory = RequestFactory()

    def create_payment(self, reference, status):
        return PaymentRequest.objects.create(
            user=self.member,
            kind=PaymentRequest.Kind.SUBSCRIPTION,
            method=PaymentRequest.Method.SADAPAY,
            amount_pkr=Decimal("249.00"),
            reference=reference,
            status=status,
        )

    def test_pending_payment_numbers_recalculate_after_reviews(self):
        reviewed = [
            self.create_payment(
                f"reviewed-{number}",
                PaymentRequest.Status.APPROVED,
            )
            for number in range(1, 9)
        ]
        pending = [
            self.create_payment(
                f"pending-{number}",
                PaymentRequest.Status.PENDING,
            )
            for number in range(1, 3)
        ]
        newest = self.create_payment(
            "pending-new",
            PaymentRequest.Status.PENDING,
        )

        request = self.request_factory.get(
            "/admin/billing/paymentrequest/",
            {"status__exact": PaymentRequest.Status.PENDING},
        )
        request.user = self.admin_user
        model_admin = PaymentRequestAdmin(PaymentRequest, admin.site)
        changelist = model_admin.get_changelist_instance(request)
        rows = list(changelist.result_list)

        self.assertEqual(
            [(row.pk, row.admin_row_number) for row in rows],
            [
                (pending[0].pk, 1),
                (pending[1].pk, 2),
                (newest.pk, 3),
            ],
        )
        model_admin.list_per_page = 2
        later_page_request = self.request_factory.get(
            "/admin/billing/paymentrequest/",
            {
                "status__exact": PaymentRequest.Status.PENDING,
                "p": "2",
            },
        )
        later_page_request.user = self.admin_user
        later_page = model_admin.get_changelist_instance(later_page_request)

        self.assertEqual(
            [(row.pk, row.admin_row_number) for row in later_page.result_list],
            [(newest.pk, 3)],
        )
        self.assertEqual(len(reviewed), 8)
