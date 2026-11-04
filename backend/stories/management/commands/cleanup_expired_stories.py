from django.core.management.base import BaseCommand

from stories.services import delete_expired_stories


class Command(BaseCommand):
    help = "Delete expired stories and their database records."

    def handle(self, *args, **options):
        deleted_count = delete_expired_stories()
        self.stdout.write(
            self.style.SUCCESS(f"Deleted {deleted_count} expired stories.")
        )
