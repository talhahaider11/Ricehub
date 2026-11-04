from io import BytesIO

from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase
from PIL import Image

from .validators import (
    MAX_POST_IMAGE_SIZE,
    MAX_POST_VIDEO_SIZE,
    validate_post_image,
    validate_post_video,
)


def make_image(image_format="PNG"):
    image = Image.new("RGB", (2, 2), color="blue")
    buffer = BytesIO()
    image.save(buffer, format=image_format)
    return SimpleUploadedFile(
        f"upload.{image_format.lower()}",
        buffer.getvalue(),
        content_type="application/octet-stream",
    )


class PostMediaValidatorTests(SimpleTestCase):
    def test_accepts_valid_supported_images_without_trusting_mime_type(self):
        for image_format in ("JPEG", "PNG", "WEBP"):
            with self.subTest(image_format=image_format):
                validate_post_image(make_image(image_format))

    def test_rejects_oversized_images(self):
        image = SimpleUploadedFile(
            "large.png",
            b"x" * (MAX_POST_IMAGE_SIZE + 1),
            content_type="image/png",
        )

        with self.assertRaisesMessage(ValidationError, "5 MB"):
            validate_post_image(image)

    def test_rejects_invalid_and_unsupported_images(self):
        fake_image = SimpleUploadedFile(
            "fake.png",
            b"not an image",
            content_type="image/png",
        )
        gif_buffer = BytesIO()
        Image.new("RGB", (2, 2)).save(gif_buffer, format="GIF")
        unsupported_image = SimpleUploadedFile(
            "unsupported.gif",
            gif_buffer.getvalue(),
            content_type="image/gif",
        )

        for image in (fake_image, unsupported_image):
            with self.subTest(name=image.name):
                with self.assertRaisesMessage(ValidationError, "valid JPEG"):
                    validate_post_image(image)

    def test_accepts_mp4_and_webm_signatures(self):
        mp4 = SimpleUploadedFile(
            "clip.mp4",
            b"\x00\x00\x00\x18ftypisom\x00\x00\x02\x00",
            content_type="application/octet-stream",
        )
        webm = SimpleUploadedFile(
            "clip.webm",
            b"\x1a\x45\xdf\xa3\x93\x42\x82\x88",
            content_type="application/octet-stream",
        )

        validate_post_video(mp4)
        validate_post_video(webm)

    def test_rejects_invalid_and_oversized_videos(self):
        fake_video = SimpleUploadedFile(
            "clip.mp4",
            b"not a video",
            content_type="video/mp4",
        )
        oversized_video = SimpleUploadedFile(
            "large.mp4",
            b"\x00\x00\x00\x18ftypisom"
            + b"x" * (MAX_POST_VIDEO_SIZE + 1),
            content_type="video/mp4",
        )

        with self.assertRaisesMessage(ValidationError, "valid MP4"):
            validate_post_video(fake_video)
        with self.assertRaisesMessage(ValidationError, "100 MB"):
            validate_post_video(oversized_video)
