import logging
from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils.text import get_valid_filename

from .image_processing import generate_thumbnail
from .models import MediaAsset
from .tasks import process_video
from .validators import validate_media_file


logger = logging.getLogger(__name__)


def _has_active_video_workers():
    try:
        workers = process_video.app.control.inspect(timeout=0.5).ping()
    except Exception:
        logger.warning(
            "Could not check for active video-processing workers.",
            exc_info=True,
        )
        return False
    return bool(workers)


def _mark_video_ready(asset):
    asset.processing_status = MediaAsset.ProcessingStatus.READY
    asset.save(update_fields=["processing_status", "updated_at"])


def _queue_video_processing(asset):
    if not getattr(settings, "CELERY_TASK_ALWAYS_EAGER", False):
        if not _has_active_video_workers():
            logger.warning(
                "No active video-processing workers; serving the original video."
            )
            _mark_video_ready(asset)
            return

    try:
        process_video.delay(asset.pk)
    except Exception:
        logger.warning(
            "Video processing could not be queued; serving the original video.",
            exc_info=True,
        )
        _mark_video_ready(asset)


def upload_media(owner, uploaded_file, media_type):
    metadata = validate_media_file(uploaded_file, media_type)
    original_filename = Path(uploaded_file.name.replace("\\", "/")).name
    safe_filename = get_valid_filename(original_filename)[:200]
    if not safe_filename:
        raise ValidationError({"file": "Choose a valid filename."})

    asset = MediaAsset(
        owner=owner,
        media_type=media_type,
        original_filename=original_filename[:255],
        mime_type=metadata["mime_type"],
        file_size=uploaded_file.size,
    )
    saved = False
    try:
        with transaction.atomic():
            asset.file = uploaded_file
            asset.file.name = f"{uuid4().hex}_{safe_filename}"
            asset.save()
            if media_type == MediaAsset.MediaType.IMAGE:
                generate_thumbnail(asset)
        saved = True
    finally:
        if not saved:
            asset.file.delete(save=False)
            asset.thumbnail.delete(save=False)
            asset.compressed_file.delete(save=False)
            if asset.pk:
                asset.delete()

    if media_type == MediaAsset.MediaType.VIDEO:
        _queue_video_processing(asset)

    return asset


@transaction.atomic
def delete_unattached_media(asset):
    asset = MediaAsset.objects.select_for_update().get(
        pk=asset.pk,
        owner=asset.owner,
    )
    if asset.processing_status == MediaAsset.ProcessingStatus.PROCESSING:
        raise ValidationError(
            {"detail": "Media being processed cannot be deleted yet."}
        )
    if asset.posts.exists():
        raise ValidationError(
            {"detail": "Media attached to a post cannot be deleted."}
        )
    if asset.stories.exists():
        raise ValidationError(
            {"detail": "Media attached to a story cannot be deleted."}
        )

    asset.file.delete(save=False)
    asset.thumbnail.delete(save=False)
    asset.compressed_file.delete(save=False)
    asset.delete()
