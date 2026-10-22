from django.core.exceptions import ValidationError


MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024


ALLOWED_ATTACHMENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
}


def validate_message_attachment(file):
    if file.size > MAX_ATTACHMENT_SIZE:
        raise ValidationError(
            "Attachment cannot exceed 10 MB."
        )

    content_type = getattr(
        file,
        "content_type",
        None,
    )

    if content_type not in ALLOWED_ATTACHMENT_TYPES:
        raise ValidationError(
            "Unsupported attachment type."
        )