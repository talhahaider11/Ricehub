import logging
from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .models import Story, StoryView
from .permissions import can_view_story

logger = logging.getLogger(__name__)


def get_active_stories():
    return Story.objects.active()


def mark_story_viewed(user, story):
    if story.author_id == user.pk:
        return None
    if not can_view_story(user, story):
        return None
    view, _ = StoryView.objects.get_or_create(story=story, viewer=user)
    return view


def _story_media_files(story):
    return [
        (field.storage, field.name)
        for field in (story.media, story.image, story.video)
        if field
    ]


def _delete_unreferenced_media(files):
    for storage, name in files:
        if Story.all_objects.filter(
            Q(media=name) | Q(image=name) | Q(video=name)
        ).exists():
            continue
        try:
            storage.delete(name)
        except Exception:
            logger.exception("Could not remove expired story media %s", name)
            raise


def delete_story(story):
    media_files = _story_media_files(story)
    with transaction.atomic():
        story.delete()
        transaction.on_commit(
            lambda: _delete_unreferenced_media(media_files)
        )


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

        media_files = [
            media_file
            for story in expired_stories
            for media_file in _story_media_files(story)
        ]
        Story.all_objects.filter(
            pk__in=[story.pk for story in expired_stories]
        ).delete()
        transaction.on_commit(
            lambda: _delete_unreferenced_media(media_files)
        )
        return len(expired_stories)
