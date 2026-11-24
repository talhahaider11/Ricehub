from django.db import transaction
from django.db.models.signals import post_delete, pre_delete
from django.dispatch import receiver

from .media_cleanup import cleanup_post_media
from .models import Post


@receiver(pre_delete, sender=Post)
def capture_post_media(sender, instance, **kwargs):
    instance._media_cleanup_files = [
        (field.storage, field.name)
        for field in (instance.image, instance.video)
        if field
    ]
    instance._media_cleanup_asset_ids = list(
        instance.media_assets.values_list("pk", flat=True)
    )


@receiver(post_delete, sender=Post)
def delete_post_media(sender, instance, **kwargs):
    files = getattr(instance, "_media_cleanup_files", [])
    asset_ids = getattr(instance, "_media_cleanup_asset_ids", [])
    transaction.on_commit(
        lambda: cleanup_post_media(files, asset_ids)
    )
