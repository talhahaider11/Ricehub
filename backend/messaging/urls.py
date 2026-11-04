from django.urls import path

from .views import (
    ConversationDetailView,
    ConversationListCreateView,
    DeleteMessageView,
    EditMessageView,
    GroupConversationCreateView,
    MarkConversationReadView,
    MessageListCreateView,
)


urlpatterns = [
    path(
        "conversations/group/",
        GroupConversationCreateView.as_view(),
        name="group-conversation-create",
    ),

    path(
        "conversations/",
        ConversationListCreateView.as_view(),
        name="conversation-list",
    ),

    path(
        "conversations/<int:pk>/",
        ConversationDetailView.as_view(),
        name="conversation-detail",
    ),

    path(
        "conversations/<int:conversation_id>/messages/",
        MessageListCreateView.as_view(),
        name="message-list",
    ),

    path(
        "conversations/<int:conversation_id>/read/",
        MarkConversationReadView.as_view(),
        name="mark-conversation-read",
    ),
    path(
        "messages/<int:message_id>/edit/",
        EditMessageView.as_view(),
        name="message-edit",
    ),
    path(
        "messages/<int:message_id>/delete/",
        DeleteMessageView.as_view(),
        name="message-delete",
    ),
]