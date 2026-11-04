from celery import shared_task

from .services import delete_expired_stories as delete_expired_story_records


@shared_task
def delete_expired_stories():
    return delete_expired_story_records()
