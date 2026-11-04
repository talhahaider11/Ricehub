from django.contrib import admin, messages

from .models import PaymentRequest
from .services import review_payment_request


@admin.register(PaymentRequest)
class PaymentRequestAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "kind",
        "amount_pkr",
        "method",
        "reference",
        "status",
        "created_at",
    )
    list_filter = ("kind", "method", "status", "created_at")
    search_fields = ("user__username", "reference")
    readonly_fields = (
        "user",
        "post",
        "kind",
        "method",
        "amount_pkr",
        "reference",
        "status",
        "created_at",
        "reviewed_by",
        "reviewed_at",
    )
    actions = ("approve_requests", "reject_requests")

    @admin.action(description="Approve selected payment requests")
    def approve_requests(self, request, queryset):
        reviewed = 0
        for payment in queryset.filter(status=PaymentRequest.Status.PENDING):
            review_payment_request(payment.pk, request.user, approved=True)
            reviewed += 1
        self.message_user(
            request,
            f"Approved {reviewed} payment request(s).",
            messages.SUCCESS,
        )

    @admin.action(description="Reject selected payment requests")
    def reject_requests(self, request, queryset):
        reviewed = 0
        for payment in queryset.filter(status=PaymentRequest.Status.PENDING):
            review_payment_request(payment.pk, request.user, approved=False)
            reviewed += 1
        self.message_user(
            request,
            f"Rejected {reviewed} payment request(s).",
            messages.SUCCESS,
        )
