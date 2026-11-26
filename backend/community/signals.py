import logging

from django.db import transaction
from django.db.models.signals import post_delete, pre_save
from django.dispatch import receiver

from .models import Event, MarketplaceListing

logger = logging.getLogger(__name__)


def _schedule_media_deletion(model, instance, field_file, field_name, label):
    if not field_file or not field_file.name:
        return

    name = field_file.name

    def delete_if_unreferenced():
        references = model.objects.filter(**{field_name: name})
        if instance.pk:
            references = references.exclude(pk=instance.pk)
        if references.exists():
            return
        try:
            field_file.delete(save=False)
        except Exception:
            logger.exception(
                "Could not remove %s media for object %s",
                label,
                instance.pk,
            )
            raise

    transaction.on_commit(delete_if_unreferenced)


def _schedule_replaced_media_cleanup(sender, instance, field_name, label):
    if not instance.pk:
        return
    try:
        previous = sender.objects.only(field_name).get(pk=instance.pk)
    except sender.DoesNotExist:
        return

    previous_file = getattr(previous, field_name)
    current_file = getattr(instance, field_name)
    if previous_file and previous_file.name != getattr(current_file, "name", None):
        _schedule_media_deletion(
            sender,
            instance,
            previous_file,
            field_name,
            label,
        )


@receiver(pre_save, sender=Event)
def delete_replaced_event_banner(sender, instance, **kwargs):
    _schedule_replaced_media_cleanup(sender, instance, "banner", "event")


@receiver(pre_save, sender=MarketplaceListing)
def delete_replaced_listing_image(sender, instance, **kwargs):
    _schedule_replaced_media_cleanup(sender, instance, "image", "marketplace listing")


@receiver(post_delete, sender=Event)
def delete_event_banner(sender, instance, **kwargs):
    _schedule_media_deletion(
        sender,
        instance,
        instance.banner,
        "banner",
        "event",
    )


@receiver(post_delete, sender=MarketplaceListing)
def delete_listing_image(sender, instance, **kwargs):
    _schedule_media_deletion(
        sender,
        instance,
        instance.image,
        "image",
        "marketplace listing",
    )
