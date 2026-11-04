from pathlib import Path
from uuid import uuid4

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils.text import get_valid_filename
from kombu.exceptions import OperationalError

from .image_processing import generate_thumbnail
from .models import MediaAsset
from .tasks import process_video
from .validators import validate_media_file


class MediaQueueUnavailable(Exception):
    pass


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
        try:
            process_video.delay(asset.pk)
        except OperationalError as error:
            asset.file.delete(save=False)
            asset.delete()
            raise MediaQueueUnavailable(
                "The video processing queue is unavailable. Please try again."
            ) from error

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
