from django.contrib import admin

from users.models import BlockedUser

from .models import AdminActionLog, ContentReport


@admin.register(BlockedUser)
class BlockedUserAdmin(admin.ModelAdmin):
    list_display = ("blocker", "blocked", "created_at")
    list_filter = ("created_at",)
    search_fields = ("blocker__username", "blocked__username")
    readonly_fields = ("created_at",)


@admin.register(ContentReport)
class ContentReportAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "reporter",
        "target_type",
        "target_id",
        "target_author",
        "reason",
        "status",
        "reviewed_by",
        "created_at",
    )
    list_filter = ("status", "target_type", "reason", "created_at")
    search_fields = (
        "reporter__username",
        "target_author__username",
        "target_text",
        "details",
    )
    readonly_fields = (
        "reporter",
        "target_type",
        "target_id",
        "target_author",
        "target_text",
        "reason",
        "details",
        "created_at",
        "updated_at",
        "reviewed_at",
    )
    list_select_related = ("reporter", "target_author", "reviewed_by")


@admin.register(AdminActionLog)
class AdminActionLogAdmin(admin.ModelAdmin):
    list_display = ("action", "actor", "target_type", "target_id", "created_at")
    list_filter = ("action", "target_type", "created_at")
    search_fields = ("actor__username", "reason")
    readonly_fields = (
        "actor",
        "action",
        "target_type",
        "target_id",
        "reason",
        "metadata",
        "created_at",
    )
