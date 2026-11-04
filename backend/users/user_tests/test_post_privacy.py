from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from comments.models import Comment
from friendships.models import FriendRequest
from posts.models import Post
from users.models import ProfileVisibility


User = get_user_model()


class PostPrivacyAccessTests(APITestCase):
    def setUp(self):
        self.viewer = User.objects.create_user(
            username="privacy-viewer",
            email="privacy-viewer@example.com",
            password="StrongPassword123",
        )
        self.author = User.objects.create_user(
            username="privacy-author",
            email="privacy-author@example.com",
            password="StrongPassword123",
        )
        self.client.force_authenticate(self.viewer)

    def test_non_visible_post_is_hidden_from_all_read_and_write_surfaces(self):
        post = Post.objects.create(
            author=self.author,
            content="private privacy needle",
            visibility=Post.Visibility.PRIVATE,
        )

        detail = self.client.get(f"/api/posts/{post.pk}/")
        comments = self.client.get(f"/api/posts/{post.pk}/comments/")
        comment_create = self.client.post(
            f"/api/posts/{post.pk}/comments/",
            {"content": "Should not be created"},
            format="json",
        )
        reactions = self.client.get(
            f"/api/posts/{post.pk}/reactions/list/"
        )
        reaction_create = self.client.post(
            f"/api/posts/{post.pk}/reactions/",
            {"reaction_type": "like"},
            format="json",
        )
        search = self.client.get(
            "/api/posts/search/",
            {"q": "private privacy needle"},
        )
        feed = self.client.get("/api/feed/")

        self.assertEqual(detail.status_code, 403)
        self.assertEqual(comments.status_code, 403)
        self.assertEqual(comment_create.status_code, 403)
        self.assertEqual(reactions.status_code, 403)
        self.assertEqual(reaction_create.status_code, 403)
        self.assertNotIn(post.pk, [item["id"] for item in search.data["results"]])
        self.assertNotIn(post.pk, [item["id"] for item in feed.data["results"]])
        self.assertFalse(Comment.objects.filter(post=post).exists())

    def test_comment_can_only_be_edited_by_its_author(self):
        post = Post.objects.create(
            author=self.author,
            content="A public post",
        )
        comment = Comment.objects.create(
            post=post,
            author=self.viewer,
            content="Original comment",
        )
        self.client.force_authenticate(self.author)

        response = self.client.patch(
            f"/api/comments/{comment.pk}/",
            {"content": "Unauthorized edit"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        comment.refresh_from_db()
        self.assertEqual(comment.content, "Original comment")

    def test_comments_by_blocked_or_muted_users_are_not_exposed(self):
        post = Post.objects.create(
            author=self.author,
            content="A public post",
        )
        hidden_author = User.objects.create_user(
            username="hidden-commenter",
            email="hidden-commenter@example.com",
            password="StrongPassword123",
        )
        muted_author = User.objects.create_user(
            username="muted-commenter",
            email="muted-commenter@example.com",
            password="StrongPassword123",
        )
        Comment.objects.create(
            post=post,
            author=hidden_author,
            content="Hidden comment",
        )
        Comment.objects.create(
            post=post,
            author=muted_author,
            content="Muted comment",
        )

        self.viewer.blocked_users.create(blocked=hidden_author)
        self.viewer.muted_users.create(muted=muted_author)

        response = self.client.get(f"/api/posts/{post.pk}/comments/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 0)

    def test_profile_privacy_hides_posts_even_when_post_is_public(self):
        self.author.profile_visibility = ProfileVisibility.PRIVATE
        self.author.save(update_fields=["profile_visibility"])
        post = Post.objects.create(
            author=self.author,
            content="A public post on a private profile",
        )

        detail = self.client.get(f"/api/posts/{post.pk}/")
        search = self.client.get(
            "/api/posts/search/",
            {"q": "private profile"},
        )

        self.assertEqual(detail.status_code, 403)
        self.assertNotIn(post.pk, [item["id"] for item in search.data["results"]])

    def test_friends_only_post_is_visible_to_accepted_friend(self):
        FriendRequest.objects.create(
            sender=self.viewer,
            receiver=self.author,
            status=FriendRequest.Status.ACCEPTED,
        )
        post = Post.objects.create(
            author=self.author,
            content="Friends-only post",
            visibility=Post.Visibility.FRIENDS,
        )

        detail = self.client.get(f"/api/posts/{post.pk}/")

        self.assertEqual(detail.status_code, 200)

    def test_expired_suspension_does_not_hide_posts_from_feed(self):
        self.author.is_active = False
        self.author.is_suspended = True
        self.author.suspended_until = timezone.now() - timedelta(minutes=1)
        self.author.suspension_was_active = True
        self.author.save(
            update_fields=[
                "is_active",
                "is_suspended",
                "suspended_until",
                "suspension_was_active",
            ]
        )
        post = Post.objects.create(
            author=self.author,
            content="Post after suspension expiry",
        )

        response = self.client.get("/api/feed/")

        self.assertEqual(response.status_code, 200)
        self.assertIn(post.pk, [item["id"] for item in response.data["results"]])
