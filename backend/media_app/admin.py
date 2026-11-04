from django.contrib import admin

from .models import MediaAsset


@admin.register(MediaAsset)
class MediaAssetAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "owner",
        "media_type",
        "file_size",
        "processing_status",
        "created_at",
    )
    list_filter = ("media_type", "processing_status", "created_at")
    search_fields = ("owner__username", "original_filename")
    readonly_fields = (
        "file_size",
        "mime_type",
        "width",
        "height",
        "duration_seconds",
        "created_at",
        "updated_at",
    )
