from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import AccountReport, SupportRequest, User


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
class CustomUserAdmin(UserAdmin):

    list_display = (
        "id",
        "username",
        "email",
        "first_name",
        "last_name",
        "is_active",
        "is_staff",
        "created_at",
    )

    search_fields = (
        "username",
        "email",
        "first_name",
        "last_name",
    )

    ordering = (
        "-created_at",
    )