from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from posts.models import Post

User = get_user_model()


class PostTests(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username="john",
            email="john@example.com",
            password="StrongPassword123!",
        )

        self.other_user = User.objects.create_user(
            username="jane",
            email="jane@example.com",
            password="StrongPassword123!",
        )

    def test_authenticated_user_can_create_post(self):
        self.client.force_authenticate(
            user=self.user
        )

        response = self.client.post(
            "/api/posts/",
            {
                "content": "Hello RiceHub!"
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            201,
        )

    def test_user_can_react_to_a_post(self):
        post = Post.objects.create(
            author=self.other_user,
            content="A public post",
        )
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            f"/api/posts/{post.id}/reactions/",
            {"reaction_type": "like"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)

    def test_user_can_comment_on_a_post(self):
        post = Post.objects.create(
            author=self.other_user,
            content="A public post",
        )
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            f"/api/posts/{post.id}/comments/",
            {"content": "Helpful post"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)