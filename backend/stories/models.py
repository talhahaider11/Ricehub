from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

from community.models import Story as CommunityStory
from community.models import StoryView as CommunityStoryView


class ActiveStoryQuerySet(models.QuerySet):
    def active(self):
        cutoff = timezone.now() - timedelta(hours=24)
        return self.filter(created_at__gte=cutoff)


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


class StoryLike(models.Model):
    story = models.ForeignKey(
        CommunityStory,
        on_delete=models.CASCADE,
        related_name="likes",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="story_likes",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "stories"
        constraints = [
            models.UniqueConstraint(
                fields=["story", "user"],
                name="unique_story_like",
            )
        ]
        indexes = [
            models.Index(
                fields=["story", "-created_at"],
                name="story_like_story_date_idx",
            )
        ]
