import tempfile

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase

from posts.models import Post
from comments.models import Comment
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

    def test_feed_returns_paginated_list_results(self):
        Post.objects.create(author=self.user, content="Feed post")

        response = self.client.get("/api/posts/")

        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.data["results"], list)
        self.assertEqual(response.data["count"], 1)

    def test_feed_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.get("/api/posts/")

        self.assertEqual(response.status_code, 401)
        self.assertIn("detail", response.data)

    def test_short_video_post_is_saved_and_returned(self):
        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root):
                video = SimpleUploadedFile(
                    "clip.mp4",
                    b"\x00\x00\x00\x18ftypisom\x00\x00\x02\x00",
                    content_type="video/mp4",
                )

                response = self.client.post(
                    "/api/posts/",
                    {"content": "A short video", "video": video},
                    format="multipart",
                )

        self.assertEqual(response.status_code, 201)
        self.assertIn("/media/posts/videos/", response.data["video"])

    def test_comment_can_be_created_and_lists_its_author(self):
        post = Post.objects.create(
            author=self.user,
            content="Post for comments",
        )

        create_response = self.client.post(
            f"/api/posts/{post.id}/comments/",
            {"content": "A test comment"},
            format="json",
        )

        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(create_response.data["content"], "A test comment")
        self.assertEqual(create_response.data["author"]["username"], self.user.username)
        self.assertTrue(
            Comment.objects.filter(
                post=post,
                author=self.user,
                content="A test comment",
            ).exists()
        )

        list_response = self.client.get(
            f"/api/posts/{post.id}/comments/",
        )

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(
            list_response.data["results"][0]["author"]["username"],
            self.user.username,
        )


class PostAuthorizationTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="post-owner",
            email="owner@example.com",
            password="StrongPassword123",
        )
        self.other_user = User.objects.create_user(
            username="post-viewer",
            email="viewer@example.com",
            password="StrongPassword123",
        )
        self.post = Post.objects.create(
            author=self.owner,
            content="Original post",
        )

    def test_owner_can_edit_and_delete_post(self):
        self.client.force_authenticate(self.owner)
        update = self.client.patch(
            f"/api/posts/{self.post.pk}/",
            {"content": "Updated by owner"},
            format="json",
        )
        self.assertEqual(update.status_code, 200)
        self.assertEqual(update.data["content"], "Updated by owner")

        deleted = self.client.delete(f"/api/posts/{self.post.pk}/")
        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(Post.objects.filter(pk=self.post.pk).exists())

    def test_other_user_cannot_edit_or_delete_public_post(self):
        self.client.force_authenticate(self.other_user)
        update = self.client.patch(
            f"/api/posts/{self.post.pk}/",
            {"content": "Unauthorized edit"},
            format="json",
        )
        deleted = self.client.delete(f"/api/posts/{self.post.pk}/")

        self.assertEqual(update.status_code, 403)
        self.assertEqual(deleted.status_code, 403)
        self.post.refresh_from_db()
        self.assertEqual(self.post.content, "Original post")

    def test_reel_requires_a_video(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post(
            "/api/posts/",
            {"content": "Video goes here", "post_type": "reel"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("video", response.data)


class PostVerificationAndModerationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="rice-poster",
            email="rice-poster@example.com",
            password="posts-test-password",
        )
        self.viewer = User.objects.create_user(
            username="rice-viewer",
            email="rice-viewer@example.com",
            password="posts-test-password",
        )
        self.client.force_authenticate(self.user)

    def test_unverified_users_can_create_only_three_posts_in_total(self):
        for index in range(3):
            response = self.client.post(
                "/api/posts/",
                {"content": f"Rice farming update {index}"},
                format="json",
            )
            self.assertEqual(response.status_code, 201)

        first_post = self.user.posts.first()
        self.client.delete(f"/api/posts/{first_post.pk}/")
        response = self.client.post(
            "/api/posts/",
            {"content": "Rice harvest update"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.user.refresh_from_db()
        self.assertEqual(self.user.posts_created, 3)

    def test_non_rice_content_is_held_for_review(self):
        response = self.client.post(
            "/api/posts/",
            {"content": "A general update"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            response.data["moderation_status"],
            Post.ModerationStatus.PENDING,
        )
        self.assertEqual(self.client.get("/api/posts/").data["count"], 1)

        self.client.force_authenticate(self.viewer)
        self.assertEqual(self.client.get("/api/posts/").data["count"], 0)
