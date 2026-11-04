from django.contrib import admin

from .models import Story, StoryView


@admin.register(Story)
class StoryAdmin(admin.ModelAdmin):
    list_display = ("id", "author", "visibility", "created_at", "expires_at")
    list_filter = ("visibility", "created_at", "expires_at")
    search_fields = ("author__username", "author__email")


@admin.register(StoryView)
class StoryViewAdmin(admin.ModelAdmin):
    list_display = ("story", "viewer", "viewed_at")
    list_filter = ("viewed_at",)
    search_fields = ("viewer__username", "story__author__username")
