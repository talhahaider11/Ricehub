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


def delete_expired_stories():
    with transaction.atomic():
        expired_story_ids = list(
            Story.all_objects
            .select_for_update()
            .filter(expires_at__lte=timezone.now())
            .values_list("pk", flat=True)
        )
        if not expired_story_ids:
            return 0

        Story.all_objects.filter(pk__in=expired_story_ids).delete()
        return len(expired_story_ids)
