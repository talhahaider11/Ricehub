import tempfile

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase

from posts.models import Post
from reactions.models import Reaction


User = get_user_model()


class FeedTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="feed-user",
            email="feed@example.com",
            password="StrongPassword123",
        )
        self.client.force_authenticate(self.user)

    def test_feed_includes_current_reaction_and_popular_order(self):
        recent_post = Post.objects.create(
            author=self.user,
            content="Recent post",
        )
        popular_post = Post.objects.create(
            author=self.user,
            content="Popular post",
        )
        Reaction.objects.create(
            user=self.user,
            post=popular_post,
            reaction_type=Reaction.ReactionType.LOVE,
        )

        response = self.client.get("/api/posts/?sort=popular")

        self.assertEqual(response.status_code, 200)
        results = response.data["results"]
        self.assertEqual(results[0]["id"], popular_post.id)
        self.assertEqual(results[0]["my_reaction"], "love")
        self.assertEqual(results[0]["reactions_count"], 1)
        self.assertEqual(results[1]["id"], recent_post.id)
        self.assertIsNone(results[1]["my_reaction"])

    def test_short_video_post_is_saved_and_returned(self):
        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root):
                video = SimpleUploadedFile(
                    "clip.mp4",
                    b"video content",
                    content_type="video/mp4",
                )

                response = self.client.post(
                    "/api/posts/",
                    {"content": "A short video", "video": video},
                    format="multipart",
                )

        self.assertEqual(response.status_code, 201)
        self.assertIn("/media/posts/videos/", response.data["video"])
