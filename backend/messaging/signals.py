from django.db import transaction
from django.db.models.signals import post_delete, pre_delete
from django.dispatch import receiver

from .models import Message


@receiver(pre_delete, sender=Message)
def capture_message_attachment(sender, instance, **kwargs):
    if instance.attachment:
        instance._attachment_cleanup = (
            instance.attachment.storage,
            instance.attachment.name,
        )


@receiver(post_delete, sender=Message)
def delete_message_attachment(sender, instance, **kwargs):
    attachment = getattr(instance, "_attachment_cleanup", None)
    if attachment:
        storage, name = attachment
        transaction.on_commit(lambda: storage.delete(name))
