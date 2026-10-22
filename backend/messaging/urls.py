from django.urls import path

from .views import (
    ConversationDetailView,
    ConversationListCreateView,
    MarkConversationReadView,
    MessageListCreateView,
)


urlpatterns = [

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
]