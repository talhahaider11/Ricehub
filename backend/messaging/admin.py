from django.contrib import admin

from .models import Conversation, ConversationMember, Message


@admin.register(Conversation)
class ConversationAdmin(
    admin.ModelAdmin
):

    list_display = (
        "id",
        "created_at",
        "updated_at",
    )

    filter_horizontal = (
        "participants",
    )


@admin.register(Message)
class MessageAdmin(
    admin.ModelAdmin
):

    list_display = (
        "id",
        "conversation",
        "sender",
        "content",
        "is_read",
        "created_at",
    )

    list_filter = (
        "is_read",
        "created_at",
    )

    search_fields = (
        "content",
        "sender__username",
    )


@admin.register(ConversationMember)
class ConversationMemberAdmin(admin.ModelAdmin):
    list_display = (
        "conversation",
        "user",
        "role",
        "is_muted",
        "joined_at",
        "last_read_at",
    )
    list_filter = ("role", "is_muted")
    search_fields = ("user__username", "conversation__name")