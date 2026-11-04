from decimal import Decimal

from django.conf import settings
from django.db import models


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
