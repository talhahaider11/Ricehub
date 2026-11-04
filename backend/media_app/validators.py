import warnings
from pathlib import Path

from django.core.exceptions import ValidationError
from PIL import Image, UnidentifiedImageError

from .models import MediaAsset


MAX_IMAGE_SIZE = 5 * 1024 * 1024
MAX_VIDEO_SIZE = 100 * 1024 * 1024
MAX_IMAGE_DIMENSION = 8192
MAX_IMAGE_PIXELS = 40_000_000
MAX_VIDEO_DURATION = 180

IMAGE_EXTENSIONS = {
    "JPEG": {".jpg", ".jpeg"},
    "PNG": {".png"},
    "WEBP": {".webp"},
}
IMAGE_MIME_TYPES = {
    "JPEG": "image/jpeg",
    "PNG": "image/png",
    "WEBP": "image/webp",
}


def _read_video_type(upload):
    upload.seek(0)
    header = upload.read(16)
    upload.seek(0)

    if len(header) >= 12 and header[4:8] == b"ftyp":
        if header[8:12] == b"qt  ":
            return "video/quicktime", {".mov"}
        return "video/mp4", {".mp4"}
    if header.startswith(b"\x1a\x45\xdf\xa3"):
        return "video/webm", {".webm"}
    return None, set()


def validate_media_file(upload, media_type):
    if media_type not in MediaAsset.MediaType.values:
        raise ValidationError({"media_type": "Choose image or video."})

    filename = Path(upload.name.replace("\\", "/")).name
    extension = Path(filename).suffix.lower()
    declared_mime = (getattr(upload, "content_type", "") or "").lower()

    if media_type == MediaAsset.MediaType.IMAGE:
        if upload.size > MAX_IMAGE_SIZE:
            raise ValidationError({"file": "Images cannot exceed 5 MB."})

        try:
            upload.seek(0)
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(upload) as image:
                    image_format = image.format
                    width, height = image.size
                    image.verify()
        except (
            Image.DecompressionBombError,
            Image.DecompressionBombWarning,
            OSError,
            SyntaxError,
            UnidentifiedImageError,
            ValueError,
        ) as error:
            raise ValidationError(
                {"file": "Only valid JPEG, PNG, and WebP images are allowed."}
            ) from error
        finally:
            upload.seek(0)

        if image_format not in IMAGE_EXTENSIONS:
            raise ValidationError(
                {"file": "Only valid JPEG, PNG, and WebP images are allowed."}
            )
        if extension not in IMAGE_EXTENSIONS[image_format]:
            raise ValidationError({"file": "The filename extension does not match the image."})
        if width > MAX_IMAGE_DIMENSION or height > MAX_IMAGE_DIMENSION:
            raise ValidationError({"file": "Image dimensions cannot exceed 8192 pixels."})
        if width * height > MAX_IMAGE_PIXELS:
            raise ValidationError({"file": "Image dimensions are too large to process."})

        mime_type = IMAGE_MIME_TYPES[image_format]
        if declared_mime and declared_mime != "application/octet-stream" and declared_mime != mime_type:
            raise ValidationError({"file": "The declared file type does not match the image."})
        return {
            "mime_type": mime_type,
            "width": width,
            "height": height,
        }

    if upload.size > MAX_VIDEO_SIZE:
        raise ValidationError({"file": "Videos cannot exceed 100 MB."})

    mime_type, extensions = _read_video_type(upload)
    if not mime_type:
        raise ValidationError(
            {"file": "Only valid MP4, WebM, and QuickTime videos are allowed."}
        )
    if extension not in extensions:
        raise ValidationError({"file": "The filename extension does not match the video."})
    if declared_mime and declared_mime != "application/octet-stream" and declared_mime != mime_type:
        raise ValidationError({"file": "The declared file type does not match the video."})
    return {"mime_type": mime_type, "width": None, "height": None}
