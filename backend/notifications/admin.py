from django.contrib import admin

from .models import Notification, PushDeliveryLog, UserDevice


@admin.register(Notification)
class NotificationAdmin(
    admin.ModelAdmin
):

    list_display = (
        "id",
        "recipient",
        "sender",
        "notification_type",
        "is_read",
        "created_at",
    )

    list_filter = (
        "notification_type",
        "is_read",
        "created_at",
    )

    search_fields = (
        "recipient__username",
        "sender__username",
        "message",
    )

    ordering = (
        "-created_at",
    )


@admin.register(UserDevice)
class UserDeviceAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "platform", "updated_at")
    list_filter = ("platform",)
    search_fields = ("user__username",)
    readonly_fields = ("token", "created_at", "updated_at")


@admin.register(PushDeliveryLog)
class PushDeliveryLogAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "notification",
        "device",
        "status",
        "attempts",
        "error_code",
        "updated_at",
    )
    list_filter = ("status", "created_at")
    search_fields = ("notification__recipient__username", "error_code")
    readonly_fields = (
        "notification",
        "device",
        "token_hash",
        "status",
        "attempts",
        "error_code",
        "created_at",
        "updated_at",
    )