import logging

from django.db import transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import Event

logger = logging.getLogger(__name__)


@receiver(post_delete, sender=Event)
def delete_event_banner(sender, instance, **kwargs):
    if not instance.banner:
        return

    storage = instance.banner.storage
    name = instance.banner.name

    def delete_banner():
        if Event.objects.filter(banner=name).exists():
            return
        try:
            storage.delete(name)
        except Exception:
            logger.exception(
                "Could not remove media for deleted event %s",
                instance.pk,
            )
            raise

    transaction.on_commit(delete_banner)
