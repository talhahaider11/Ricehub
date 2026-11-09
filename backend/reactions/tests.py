from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from posts.models import Post
from reactions.models import Reaction


class PostReactionTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username="reaction-user",
            email="reaction@example.com",
            password="test-password",
            is_email_verified=True,
        )
        self.author = user_model.objects.create_user(
            username="reaction-author",
            email="author@example.com",
            password="test-password",
            is_email_verified=True,
        )
        self.post = Post.objects.create(author=self.author, content="Test post")
        self.client.force_authenticate(self.user)

    def test_love_and_care_reactions_are_accepted(self):
        for reaction_type in (
            Reaction.ReactionType.LOVE,
            Reaction.ReactionType.CARE,
        ):
            with self.subTest(reaction_type=reaction_type):
                response = self.client.post(
                    f"/api/posts/{self.post.pk}/reactions/",
                    {"reaction_type": reaction_type},
                    format="json",
                )

                self.assertIn(response.status_code, (200, 201))
                self.assertEqual(response.data["reaction_type"], reaction_type)
