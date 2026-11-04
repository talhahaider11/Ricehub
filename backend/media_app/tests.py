from io import BytesIO
import tempfile
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image
from rest_framework.test import APITestCase

from .models import MediaAsset


User = get_user_model()


def image_upload(name="photo.png", image_format="PNG", content_type="image/png"):
    output = BytesIO()
    Image.new("RGB", (16, 12), color="blue").save(output, format=image_format)
    return SimpleUploadedFile(name, output.getvalue(), content_type=content_type)


class MediaUploadTests(APITestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        settings_override = override_settings(MEDIA_ROOT=self.temp_dir.name)
        settings_override.enable()
        self.addCleanup(settings_override.disable)
        self.user = User.objects.create_user(
            username="media-owner",
            email="media-owner@example.com",
            password="test-password",
        )
        self.other_user = User.objects.create_user(
            username="another-owner",
            email="another-owner@example.com",
            password="test-password",
        )
        self.client.force_authenticate(self.user)

    def upload_image(self, user=None, name="photo.png"):
        from .services import upload_media

        return upload_media(
            user or self.user,
            image_upload(name),
            MediaAsset.MediaType.IMAGE,
        )

    def test_image_upload_creates_verified_thumbnail_and_metadata(self):
        response = self.client.post(
            "/api/media/upload/",
            {
                "file": image_upload(),
                "media_type": MediaAsset.MediaType.IMAGE,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        asset = MediaAsset.objects.get(pk=response.data["id"])
        self.assertEqual(asset.processing_status, MediaAsset.ProcessingStatus.READY)
        self.assertTrue(asset.thumbnail)
        self.assertEqual((asset.width, asset.height), (16, 12))
        self.assertEqual(asset.mime_type, "image/png")
        self.assertTrue(response.data["url"].startswith("http://testserver/"))
        self.assertTrue(response.data["thumbnail_url"])

    def test_upload_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.post(
            "/api/media/upload/",
            {
                "file": image_upload(),
                "media_type": MediaAsset.MediaType.IMAGE,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 401)

    def test_rejects_spoofed_image_and_mismatched_mime_type(self):
        fake_image = SimpleUploadedFile(
            "fake.png",
            b"not an image",
            content_type="image/png",
        )
        response = self.client.post(
            "/api/media/upload/",
            {"file": fake_image, "media_type": MediaAsset.MediaType.IMAGE},
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(MediaAsset.objects.exists())

    @patch("media_app.services.process_video.delay")
    def test_video_upload_is_queued_and_not_reported_ready(self, enqueue):
        video = SimpleUploadedFile(
            "clip.mp4",
            b"\x00\x00\x00\x18ftypisom\x00\x00\x02\x00",
            content_type="video/mp4",
        )

        response = self.client.post(
            "/api/media/upload/",
            {"file": video, "media_type": MediaAsset.MediaType.VIDEO},
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["processing_status"], "pending")
        self.assertEqual(response.data["mime_type"], "video/mp4")
        enqueue.assert_called_once_with(response.data["id"])

    def test_post_can_attach_media_only_owned_by_the_request_user(self):
        asset = self.upload_image()
        response = self.client.post(
            "/api/posts/",
            {"content": "", "media_ids": [asset.pk]},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["media_assets"][0]["id"], asset.pk)
        self.assertEqual(response.data["media_assets"][0]["media_type"], "image")

    def test_post_rejects_another_users_media(self):
        asset = self.upload_image(user=self.other_user, name="other.png")
        response = self.client.post(
            "/api/posts/",
            {"content": "Not my upload", "media_ids": [asset.pk]},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("media_ids", response.data)
        self.assertFalse(asset.posts.exists())

    def test_owner_can_check_media_processing_status(self):
        asset = self.upload_image()

        response = self.client.get(f"/api/media/{asset.pk}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["processing_status"], "ready")

    def test_user_cannot_check_another_users_media_processing_status(self):
        asset = self.upload_image(user=self.other_user, name="private.png")

        response = self.client.get(f"/api/media/{asset.pk}/")

        self.assertEqual(response.status_code, 404)

    def test_attached_media_cannot_be_deleted(self):
        asset = self.upload_image()
        post_response = self.client.post(
            "/api/posts/",
            {"content": "", "media_ids": [asset.pk]},
            format="json",
        )

        response = self.client.delete(f"/api/media/{asset.pk}/")

        self.assertEqual(post_response.status_code, 201)
        self.assertEqual(response.status_code, 400)
        self.assertTrue(MediaAsset.objects.filter(pk=asset.pk).exists())

    def test_story_media_cannot_be_deleted_while_referenced(self):
        from stories.models import Story

        asset = self.upload_image()
        story = Story.objects.create(
            author=self.user,
            text="Attached story",
            media_asset=asset,
        )

        response = self.client.delete(f"/api/media/{asset.pk}/")

        self.assertEqual(response.status_code, 400)
        self.assertTrue(MediaAsset.objects.filter(pk=asset.pk).exists())
        self.assertTrue(Story.objects.filter(pk=story.pk).exists())
