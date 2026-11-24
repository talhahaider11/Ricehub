import logging

from django.db.models import Q

from community.models import Story
from media_app.models import MediaAsset

logger = logging.getLogger(__name__)


def cleanup_orphaned_media_assets(asset_ids):
    from .models import Post

    for asset in MediaAsset.objects.filter(pk__in=set(asset_ids)).iterator():
        if (
            Post.objects.filter(media_assets=asset).exists()
            or Story.objects.filter(media_asset=asset).exists()
        ):
            continue

        files = [
            (field.storage, field.name)
            for field in (asset.file, asset.thumbnail, asset.compressed_file)
            if field
        ]
        asset.delete()
        try:
            for storage, name in files:
                storage.delete(name)
        except Exception:
            logger.exception(
                "Could not remove media files for orphaned asset %s",
                asset.pk,
            )
            raise


def cleanup_post_media(files, asset_ids):
    try:
        cleanup_unreferenced_post_files(files)
        cleanup_orphaned_media_assets(asset_ids)
    except Exception:
        logger.exception("Could not remove deleted post media")
        raise


def cleanup_unreferenced_post_files(files):
    from .models import Post

    for storage, name in files:
        if Post.objects.filter(Q(image=name) | Q(video=name)).exists():
            continue
        storage.delete(name)
