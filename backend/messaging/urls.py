from django.urls import path

from .views import (
    ConversationArchiveView,
    ConversationDeleteView,
    ConversationDetailView,
    ConversationListCreateView,
    ConversationMuteView,
    DeleteMessageView,
    EditMessageView,
    GroupConversationCreateView,
    GroupConversationMemberAddView,
    GroupConversationMemberManageView,
    GroupConversationLeaveView,
    GroupConversationSettingsView,
    GroupMemberSearchView,
    MarkConversationReadView,
    MessageListCreateView,
)


urlpatterns = [
    path("group-members/search/", GroupMemberSearchView.as_view(), name="group-member-search"),
    path("conversations/group/",GroupConversationCreateView.as_view(),name="group-conversation-create",),
    path("conversations/<int:conversation_id>/members/",GroupConversationMemberAddView.as_view(),name="group-conversation-member-add",),
    path("conversations/<int:conversation_id>/members/<int:user_id>/",GroupConversationMemberManageView.as_view(),name="group-conversation-member-manage",),
    path("conversations/<int:conversation_id>/leave/",GroupConversationLeaveView.as_view(),name="group-conversation-leave",),
    path("conversations/<int:conversation_id>/settings/",GroupConversationSettingsView.as_view(),name="group-conversation-settings",),
    path("conversations/<int:conversation_id>/mute/",ConversationMuteView.as_view(),name="conversation-mute",),
    path("conversations/",ConversationListCreateView.as_view(),name="conversation-list",),
    path("conversations/<int:conversation_id>/archive/", ConversationArchiveView.as_view(), name="conversation-archive"),
    path("conversations/<int:conversation_id>/delete/", ConversationDeleteView.as_view(), name="conversation-delete"),
    path("conversations/<int:pk>/",ConversationDetailView.as_view(),name="conversation-detail",),
    path("conversations/<int:conversation_id>/messages/",MessageListCreateView.as_view(),name="message-list",),
    path("conversations/<int:conversation_id>/read/",MarkConversationReadView.as_view(),name="mark-conversation-read",),
    path("messages/<int:message_id>/edit/",EditMessageView.as_view(), name="message-edit",),
    path("messages/<int:message_id>/delete/",DeleteMessageView.as_view(),name="message-delete",),
]