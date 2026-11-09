from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from config.admin import NumberedAdminMixin
from .models import AccountReport, SecurityEvent, SupportRequest, User


@admin.register(AccountReport)
class AccountReportAdmin(admin.ModelAdmin):
    list_display = ("id", "reporter", "reported_user", "reason", "status", "created_at")
    list_filter = ("reason", "status", "created_at")
    search_fields = ("reporter__username", "reported_user__username", "details")
    readonly_fields = ("reporter", "reported_user", "reason", "details", "created_at")


@admin.register(SupportRequest)
class SupportRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "reporter", "subject", "status", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("reporter__username", "subject", "details")
    readonly_fields = ("reporter", "subject", "details", "created_at")


@admin.register(User)
class CustomUserAdmin(NumberedAdminMixin, UserAdmin):

    list_display = (
        "row_number",
        "username",
        "email",
        "first_name",
        "last_name",
        "is_active",
        "is_verified",
        "is_suspended",
        "is_staff",
        "created_at",
    )

    search_fields = (
        "username",
        "email",
        "first_name",
        "last_name",
    )

    ordering = ("created_at", "pk")
    list_filter = ("is_active", "is_verified", "is_staff", "is_suspended")


@admin.register(SecurityEvent)
class SecurityEventAdmin(admin.ModelAdmin):
    list_display = ("event_type", "user", "ip_address", "created_at")
    list_filter = ("event_type", "created_at")
    search_fields = ("user__username", "ip_address")
    readonly_fields = (
        "user",
        "event_type",
        "ip_address",
        "user_agent",
        "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False