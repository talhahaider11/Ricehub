from celery import shared_task
from django.db import transaction

from .models import MediaAsset
from .video_processing import process_video_asset


@shared_task
def process_video(media_id):
    try:
        with transaction.atomic():
            asset = MediaAsset.objects.select_for_update().get(pk=media_id)
            asset.processing_status = MediaAsset.ProcessingStatus.PROCESSING
            asset.processing_error = ""
            asset.save(
                update_fields=["processing_status", "processing_error", "updated_at"]
            )
    except MediaAsset.DoesNotExist:
        return {"status": "deleted"}

    try:
        process_video_asset(asset)
    except Exception as error:
        # The original upload remains playable when optional transcoding fails.
        asset.processing_status = MediaAsset.ProcessingStatus.READY
        asset.processing_error = str(error)[:1000]
        asset.save(
            update_fields=["processing_status", "processing_error", "updated_at"]
        )

    return {"status": asset.processing_status}
