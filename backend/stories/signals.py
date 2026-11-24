import logging

from django.db import transaction
from django.db.models import Q
from django.db.models.signals import post_delete
from django.dispatch import receiver

from community.models import Story as CommunityStory
from .models import Story

logger = logging.getLogger(__name__)


@receiver(post_delete, sender=Story)
@receiver(post_delete, sender=CommunityStory)
def delete_story_media(sender, instance, **kwargs):
    files = [
        (field.storage, field.name)
        for field in (instance.media, instance.image, instance.video)
        if field
    ]

    def delete_unreferenced_files():
        try:
            for storage, name in files:
                if CommunityStory.objects.filter(
                    Q(media=name) | Q(image=name) | Q(video=name)
                ).exists():
                    continue
                storage.delete(name)
        except Exception:
            logger.exception(
                "Could not remove media for deleted story %s",
                instance.pk,
            )
            raise

    transaction.on_commit(delete_unreferenced_files)
