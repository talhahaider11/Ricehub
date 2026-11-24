from django.core.management.base import BaseCommand

from community.event_cleanup import cleanup_expired_event_media


class Command(BaseCommand):
    help = "Delete media from events that have ended."

    def handle(self, *args, **options):
        cleaned_count = cleanup_expired_event_media()
        self.stdout.write(
            self.style.SUCCESS(
                f"Removed media from {cleaned_count} expired events."
            )
        )
