from django.contrib import admin

from .models import Hashtag, Post


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "author",
        "content",
        "visibility",
        "moderation_status",
        "created_at",
    )
    search_fields = ("content", "author__username")
    list_filter = ("visibility", "moderation_status", "created_at")


@admin.register(Hashtag)
class HashtagAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "created_at")
    search_fields = ("name",)