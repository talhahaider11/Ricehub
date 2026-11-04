from django.db import models
from django.utils import timezone

from community.models import Story as CommunityStory
from community.models import StoryView as CommunityStoryView


class ActiveStoryQuerySet(models.QuerySet):
    def active(self):
        return self.filter(expires_at__gt=timezone.now())


class ActiveStoryManager(models.Manager.from_queryset(ActiveStoryQuerySet)):
    def get_queryset(self):
        return super().get_queryset().active()


class Story(CommunityStory):
    objects = ActiveStoryManager()
    all_objects = models.Manager()

    class Meta:
        proxy = True
        app_label = "stories"
        ordering = ["created_at"]


class StoryView(CommunityStoryView):
    class Meta:
        proxy = True
        app_label = "stories"
