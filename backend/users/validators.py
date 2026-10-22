from django.core.exceptions import ValidationError


def validate_strong_password(password):
    if len(password) < 8:
        raise ValidationError(
            "Password must contain at least 8 characters."
        )

    if not any(char.isupper() for char in password):
        raise ValidationError(
            "Password must contain at least one uppercase letter."
        )

    if not any(char.islower() for char in password):
        raise ValidationError(
            "Password must contain at least one lowercase letter."
        )

    if not any(char.isdigit() for char in password):
        raise ValidationError(
            "Password must contain at least one number."
        )


MAX_IMAGE_SIZE = 5 * 1024 * 1024


def validate_profile_image(image):

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

def validate_image_upload(image):
    if image.size > MAX_IMAGE_SIZE:
        raise ValidationError(
            "Image cannot exceed 5 MB."
        )

    content_type = getattr(
        image,
        "content_type",
        None,
    )

    if content_type not in ALLOWED_IMAGE_TYPES:
        raise ValidationError(
            "Only JPEG, PNG and WebP images are allowed."
        )
