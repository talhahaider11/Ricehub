from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase
from PIL import Image


User = get_user_model()


class UserProfileTests(APITestCase):
    def setUp(self):
        self.viewer = User.objects.create_user(
            username="viewer",
            email="viewer@example.com",
            password="StrongPassword123",
        )
        self.profile = User.objects.create_user(
            username="profile",
            email="profile@example.com",
            password="StrongPassword123",
        )
        self.client.force_authenticate(user=self.viewer)

    def test_public_profile_is_visible(self):
        response = self.client.get(f"/api/users/{self.profile.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], self.profile.id)

    def test_private_profile_is_hidden(self):
        self.profile.profile_visibility = "private"
        self.profile.save(update_fields=["profile_visibility"])

        response = self.client.get(f"/api/users/{self.profile.id}/")

        self.assertEqual(response.status_code, 403)

    def test_user_can_update_profile_visibility(self):
        response = self.client.patch(
            "/api/users/me/update/",
            {"profile_visibility": "private"},
            format="multipart",
        )

        self.assertEqual(response.status_code, 200)
        self.viewer.refresh_from_db()
        self.assertEqual(self.viewer.profile_visibility, "private")

    def test_profile_picture_is_compressed_and_replaced_file_is_deleted(self):
        def image_upload(name, color):
            output = BytesIO()
            Image.new("RGB", (800, 600), color=color).save(output, format="JPEG")
            return SimpleUploadedFile(
                name,
                output.getvalue(),
                content_type="image/jpeg",
            )

        first_response = self.client.patch(
            "/api/users/me/update/",
            {"profile_picture": image_upload("first.jpg", "red")},
            format="multipart",
        )
        self.assertEqual(first_response.status_code, 200)
        self.viewer.refresh_from_db()
        first_name = self.viewer.profile_picture.name
        storage = self.viewer.profile_picture.storage
        self.assertTrue(first_name.startswith("profile_pics/"))
        self.assertTrue(first_name.endswith(".webp"))

        with storage.open(first_name, "rb") as saved_image:
            with Image.open(saved_image) as image:
                self.assertEqual(image.format, "WEBP")
                self.assertLessEqual(max(image.size), 400)

        with self.captureOnCommitCallbacks(execute=True):
            second_response = self.client.patch(
                "/api/users/me/update/",
                {"profile_picture": image_upload("second.jpg", "blue")},
                format="multipart",
            )
        self.assertEqual(second_response.status_code, 200)
        self.viewer.refresh_from_db()
        self.assertNotEqual(self.viewer.profile_picture.name, first_name)
        self.assertFalse(storage.exists(first_name))
        storage.delete(self.viewer.profile_picture.name)
