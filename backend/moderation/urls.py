from django.urls import path,include
from .views import (
    BlockUserView,
    BlockedUsersView,
)

urlpatterns = [
    # Block & Unblock combined path (POST for block, DELETE for unblock)
    path(
        "users/<int:user_id>/block/",
        BlockUserView.as_view(),
        name="block-user",
    ),
    # List of blocked users
    path(
        "blocks/",
        BlockedUsersView.as_view(),
        name="blocked-users",
    ),
    path(
        "api/moderation/",
        include("moderation.urls"),
    ),
]