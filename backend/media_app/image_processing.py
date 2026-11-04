from io import BytesIO

from django.core.files.base import ContentFile
from PIL import Image, ImageOps

from .models import MediaAsset


def generate_thumbnail(asset):
    if asset.media_type != MediaAsset.MediaType.IMAGE or not asset.file:
        return

    with asset.file.open("rb") as source:
        with Image.open(source) as original:
            image = ImageOps.exif_transpose(original).convert("RGB")
            asset.width, asset.height = image.size
            image.thumbnail((800, 800))

            output = BytesIO()
            image.save(output, format="JPEG", quality=82, optimize=True)

    asset.thumbnail.save(
        f"{asset.pk}_thumbnail.jpg",
        ContentFile(output.getvalue()),
        save=False,
    )
    asset.processing_status = MediaAsset.ProcessingStatus.READY
    asset.save(
        update_fields=[
            "thumbnail",
            "width",
            "height",
            "processing_status",
            "updated_at",
        ]
    )
