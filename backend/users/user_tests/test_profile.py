from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase


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
