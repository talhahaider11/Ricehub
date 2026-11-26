import logging

from django.db.models import Q
from django.utils import timezone

from .models import Event

logger = logging.getLogger(__name__)


def cleanup_expired_event_media():
    now = timezone.now()
    expired_events = list(
        Event.objects
        .filter(
            Q(ends_at__lte=now)
            | Q(ends_at__isnull=True, starts_at__lte=now)
        )
        .exclude(Q(banner__isnull=True) | Q(banner=""))
        .only("pk", "banner")
    )
    cleaned_count = 0

    for event in expired_events:
        banner = event.banner
        if not Event.objects.exclude(pk=event.pk).filter(
            banner=banner.name
        ).exists():
            try:
                banner.delete(save=False)
            except Exception:
                logger.exception(
                    "Could not remove expired event banner for event %s",
                    event.pk,
                )
                raise
        Event.objects.filter(pk=event.pk).update(banner=None)
        cleaned_count += 1

    return cleaned_count
