from django.urls import path

from .views import (
    PostReactionListView,
    PostReactionView,
)


urlpatterns = [
    path(
        "posts/<int:post_id>/reactions/",
        PostReactionView.as_view(),
        name="post-reaction",
    ),

    path(
        "posts/<int:post_id>/reactions/list/",
        PostReactionListView.as_view(),
        name="post-reaction-list",
    ),
]