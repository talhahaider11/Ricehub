from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

User = get_user_model()


class PostTests(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username="alice",
            password="StrongPassword123",
        )

        self.client.force_authenticate(
            user=self.user
        )

    def test_create_post(self):
        response = self.client.post(
            "/api/posts/",
            {
                "content": "My first RiceHub post!",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            201,
        )

def test_empty_post_rejected(self):
    response = self.client.post(
        "/api/posts/",
        {
            "content": "",
        },
        format="json",
    )

    self.assertEqual(
        response.status_code,
        400,
    )
def test_owner_can_edit_post(self):
    post = self.create_post()

    response = self.client.patch(
        f"/api/posts/{post.id}/",
        {
            "content": "Updated content",
        },
        format="json",
    )

    self.assertEqual(
        response.status_code,
        200,
    )
owner = User.objects.create_user(
    username="alice",
    password="Password123",
)

other = User.objects.create_user(
    username="bob",
    password="Password123",
)