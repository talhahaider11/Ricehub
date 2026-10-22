from django.urls import path

from .views import (
    HashtagSearchView,
    PostDetailView,
    PostListCreateView,
)


urlpatterns = [
    path(
        "",
        PostListCreateView.as_view(),
        name="post-list-create",
    ),

    path(
        "<int:pk>/",
        PostDetailView.as_view(),
        name="post-detail",
    ),

    path(
    "hashtags/search/",
    HashtagSearchView.as_view(),
    name="hashtag-search",
),
]