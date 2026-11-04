from django.core.exceptions import ValidationError
from PIL import Image, UnidentifiedImageError


MAX_POST_IMAGE_SIZE = 5 * 1024 * 1024
MAX_POST_VIDEO_SIZE = 100 * 1024 * 1024

ALLOWED_POST_IMAGE_FORMATS = frozenset({"JPEG", "PNG", "WEBP"})
INVALID_IMAGE_MESSAGE = "Only valid JPEG, PNG and WebP images are allowed."
INVALID_VIDEO_MESSAGE = "Only valid MP4 and WebM videos are allowed."


def validate_post_image(image):
    if image.size > MAX_POST_IMAGE_SIZE:
        raise ValidationError("Image size cannot exceed 5 MB.")

    try:
        image.seek(0)
        with Image.open(image) as decoded_image:
            if decoded_image.format not in ALLOWED_POST_IMAGE_FORMATS:
                raise ValidationError(INVALID_IMAGE_MESSAGE)
            decoded_image.verify()
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError,
            Image.DecompressionBombError) as error:
        raise ValidationError(INVALID_IMAGE_MESSAGE) from error
    finally:
        image.seek(0)


def validate_post_video(video):
    if video.size > MAX_POST_VIDEO_SIZE:
        raise ValidationError("Videos cannot exceed 100 MB.")

    try:
        video.seek(0)
        header = video.read(12)
    finally:
        video.seek(0)

    is_mp4 = len(header) >= 8 and header[4:8] == b"ftyp"
    is_webm = header.startswith(b"\x1a\x45\xdf\xa3")
    if not (is_mp4 or is_webm):
        raise ValidationError(INVALID_VIDEO_MESSAGE)
