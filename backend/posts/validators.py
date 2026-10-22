from django.core.exceptions import ValidationError


MAX_IMAGE_SIZE = 5 * 1024 * 1024
MAX_VIDEO_SIZE = 50 * 1024 * 1024


def validate_post_image(image):

    if image.size > MAX_IMAGE_SIZE:
        raise ValidationError(
            "Image size cannot exceed 5 MB."
        )

    allowed_types = [
        "image/jpeg",
        "image/png",
        "image/webp",
    ]

    if getattr(image, "content_type", None) not in allowed_types:
        raise ValidationError(
            "Only JPEG, PNG and WebP images are allowed."
        )


def validate_post_video(video):
    if video.size > MAX_VIDEO_SIZE:
        raise ValidationError("Videos cannot exceed 50 MB.")
    if getattr(video, "content_type", None) not in {
        "video/mp4",
        "video/webm",
    }:
        raise ValidationError("Only MP4 and WebM videos are allowed.")
