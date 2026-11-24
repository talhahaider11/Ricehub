from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from .models import Story, StoryView
from .permissions import can_view_story

def get_active_stories():
    return Story.objects.active()


def mark_story_viewed(user, story):
    if story.author_id == user.pk:
        return None
    if not can_view_story(user, story):
        return None
    view, _ = StoryView.objects.get_or_create(story=story, viewer=user)
    return view


def delete_story(story):
    story.delete()


def delete_expired_stories():
    cutoff = timezone.now() - timedelta(hours=24)
    with transaction.atomic():
        expired_stories = list(
            Story.all_objects
            .select_for_update()
            .filter(created_at__lt=cutoff)
        )
        if not expired_stories:
            return 0

        Story.all_objects.filter(
            pk__in=[story.pk for story in expired_stories]
        ).delete()
        return len(expired_stories)
