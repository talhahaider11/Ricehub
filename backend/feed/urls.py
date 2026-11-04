from django.urls import path

from .views import FeedPostViewView, FeedView, ForYouFeedView


urlpatterns = [
    path("", FeedView.as_view(), name="feed"),
    path("for-you/", ForYouFeedView.as_view(), name="for-you-feed"),
    path(
        "<int:post_id>/view/",
        FeedPostViewView.as_view(),
        name="feed-post-view",
    ),
]
