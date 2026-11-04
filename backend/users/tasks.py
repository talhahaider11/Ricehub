from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from .models import SecurityEvent


@shared_task
def purge_expired_security_events():
    cutoff = timezone.now() - timedelta(
        days=settings.SECURITY_EVENT_RETENTION_DAYS
    )
    deleted_count, _ = SecurityEvent.objects.filter(
        created_at__lt=cutoff
    ).delete()
    return deleted_count
