from decimal import Decimal
from pathlib import PurePath
from uuid import uuid4

from django.conf import settings
from django.db import models


def payment_receipt_upload_path(instance, filename):
    extension = PurePath(filename).suffix.lower()
    return f"payment-receipts/{instance.user_id}/{uuid4().hex}{extension}"


class PaymentRequest(models.Model):
    class Kind(models.TextChoices):
        SUBSCRIPTION = "subscription", "Monthly verification"
        BOOST_WEEK = "boost_week", "Post boost - 1 week"
        BOOST_MONTH = "boost_month", "Post boost - 1 month"

    class Method(models.TextChoices):
        SADAPAY = "sadapay", "SadaPay transfer"
        CARD = "card", "Debit/Mastercard transfer"
        EASYPAISA = "easypaisa", "EasyPaisa transfer"
        JAZZCASH = "jazzcash", "JazzCash transfer"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending review"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    class TransferApp(models.TextChoices):
        SADAPAY = "sadapay", "SadaPay"
        EASYPAISA = "easypaisa", "EasyPaisa"
        JAZZCASH = "jazzcash", "JazzCash"
        BANK = "bank", "Bank transfer"
        OTHER = "other", "Other"

    PRICES = {
        Kind.SUBSCRIPTION: Decimal("249.00"),
        Kind.BOOST_WEEK: Decimal("149.00"),
        Kind.BOOST_MONTH: Decimal("350.00"),
    }

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="payment_requests",
    )
    post = models.ForeignKey(
        "posts.Post",
        on_delete=models.CASCADE,
        related_name="boost_payment_requests",
        blank=True,
        null=True,
    )
    kind = models.CharField(max_length=20, choices=Kind.choices)
    method = models.CharField(max_length=20, choices=Method.choices)
    amount_pkr = models.DecimalField(max_digits=8, decimal_places=2)
    reference = models.CharField(max_length=120)
    sender_name = models.CharField(max_length=120, blank=True)
    sender_phone = models.CharField(max_length=32, blank=True)
    transfer_app = models.CharField(
        max_length=20,
        choices=TransferApp.choices,
        blank=True,
    )
    receipt = models.ImageField(
        upload_to=payment_receipt_upload_path,
        blank=True,
        null=True,
    )
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING,
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="reviewed_payment_requests",
        blank=True,
        null=True,
    )
    reviewed_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["method", "reference"],
                name="unique_payment_transfer_reference",
            ),
        ]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["user", "created_at"]),
        ]

    def __str__(self):
        return f"{self.user} - {self.get_kind_display()} ({self.status})"
