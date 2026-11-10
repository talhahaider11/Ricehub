from django.urls import path

from .views import (
    MarkStoryViewedView,
    StoryDetailView,
    StoryListCreateView,
    StoryViewerListView,
)


urlpatterns = [
    path("", StoryListCreateView.as_view(), name="story-list-create"),
    path("create/", StoryListCreateView.as_view(), name="story-create"),
    path("<int:story_id>/", StoryDetailView.as_view(), name="story-detail"),
    path("<int:story_id>/view/",MarkStoryViewedView.as_view(),name="story-view",),
    path("<int:story_id>/viewers/",StoryViewerListView.as_view(), name="story-viewers",),
    path("<int:story_id>/delete/", StoryDetailView.as_view(), name="story-delete",),
]
