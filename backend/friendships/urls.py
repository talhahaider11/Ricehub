from django.urls import path

from .views import (
    FriendListView,
    FriendRequestActionView,
    FriendRequestListCreateView,
)


urlpatterns = [
    path("", FriendListView.as_view(), name="friend-list"),
    path(
        "requests/",
        FriendRequestListCreateView.as_view(),
        name="friend-request-list-create",
    ),
    path(
        "requests/<int:pk>/respond/",
        FriendRequestActionView.as_view(),
        name="friend-request-action",
    ),
]