from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from friendships.models import FriendRequest
from posts.models import Hashtag, Post
from users.models import BlockedUser, UserPrivacySettings


User = get_user_model()


class DiscoveryApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="discovery-viewer",
            email="viewer@example.com",
            password="test-password",
        )
        self.client.force_authenticate(user=self.user)

    def create_user(self, username, **kwargs):
        return User.objects.create_user(
            username=username,
            email=f"{username}@example.com",
            password="test-password",
            **kwargs,
        )

    def accept_friendship(self, first, second):
        return FriendRequest.objects.create(
            sender=first,
            receiver=second,
            status=FriendRequest.Status.ACCEPTED,
        )

    def test_user_search_respects_profile_privacy_and_account_status(self):
        visible = self.create_user("discovery-visible")
        self.create_user(
            "discovery-private",
            profile_visibility="private",
        )
        self.create_user(
            "discovery-inactive",
            is_active=False,
        )
        self.create_user(
            "discovery-suspended",
            is_suspended=True,
        )
        blocked = self.create_user("discovery-blocked")
        BlockedUser.objects.create(blocker=self.user, blocked=blocked)

        response = self.client.get("/api/users/search/?q=discovery-")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [result["id"] for result in response.data["results"]],
            [visible.pk],
        )
        self.assertIn("count", response.data)

    def test_search_does_not_expose_disabled_online_status(self):
        hidden_presence = self.create_user(
            "discovery-presence",
            is_online=True,
        )
        UserPrivacySettings.objects.create(
            user=hidden_presence,
            show_activity_status=False,
        )

        response = self.client.get("/api/users/search/?q=discovery-presence")

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["results"][0]["is_online"])

    def test_suggestions_rank_mutual_friends_and_exclude_pending_requests(self):
        friend = self.create_user("mutual-friend")
        candidate = self.create_user("mutual-candidate")
        pending = self.create_user("pending-candidate")
        self.accept_friendship(self.user, friend)
        self.accept_friendship(friend, candidate)
        FriendRequest.objects.create(
            sender=self.user,
            receiver=pending,
            status=FriendRequest.Status.PENDING,
        )
        self.accept_friendship(friend, pending)

        response = self.client.get("/api/users/suggestions/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [result["id"] for result in response.data["results"]],
            [candidate.pk],
        )

    def test_post_search_is_paginated_and_hides_non_visible_posts(self):
        author = self.create_user("post-search-author")
        public_post = Post.objects.create(
            author=author,
            content="discovery keyword public",
        )
        second_public_post = Post.objects.create(
            author=author,
            content="discovery keyword public second",
        )
        private_author = self.create_user("private-post-author")
        Post.objects.create(
            author=private_author,
            content="discovery keyword private",
            visibility=Post.Visibility.FRIENDS,
        )

        response = self.client.get(
            "/api/posts/search/?q=discovery%20keyword&page_size=1"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 2)
        self.assertIsNotNone(response.data["next"])
        second_page = self.client.get(
            "/api/posts/search/?q=discovery%20keyword&page_size=1&page=2"
        )
        self.assertEqual(second_page.status_code, 200)
        self.assertEqual(
            {
                response.data["results"][0]["id"],
                second_page.data["results"][0]["id"],
            },
            {public_post.pk, second_public_post.pk},
        )

    def test_hashtag_page_and_trending_only_include_visible_posts(self):
        author = self.create_user("hashtag-author")
        visible_post = Post.objects.create(
            author=author,
            content="Visible #privacytag",
        )
        hidden_author = self.create_user("hidden-hashtag-author")
        hidden_post = Post.objects.create(
            author=hidden_author,
            content="Hidden #privacytag",
            visibility=Post.Visibility.FRIENDS,
        )
        hashtag = Hashtag.objects.create(name="privacytag")
        visible_post.hashtags.add(hashtag)
        hidden_post.hashtags.add(hashtag)

        detail = self.client.get("/api/hashtags/privacytag/")
        trending = self.client.get("/api/hashtags/trending/")

        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data["hashtag"], "privacytag")
        self.assertEqual(
            [post["id"] for post in detail.data["posts"]],
            [visible_post.pk],
        )
        self.assertIn("privacytag", [tag["name"] for tag in trending.data["results"]])
        self.assertEqual(
            next(
                tag["post_count"]
                for tag in trending.data["results"]
                if tag["name"] == "privacytag"
            ),
            1,
        )

    def test_explore_returns_visible_paginated_posts_and_discovery_sections(self):
        author = self.create_user("explore-author")
        public_post = Post.objects.create(
            author=author,
            content="Visible explore content",
        )
        hidden_author = self.create_user("explore-hidden")
        Post.objects.create(
            author=hidden_author,
            content="Hidden explore content",
            visibility=Post.Visibility.PRIVATE,
        )

        response = self.client.get("/api/explore/?page_size=1")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [post["id"] for post in response.data["posts"]],
            [public_post.pk],
        )
        self.assertEqual(response.data["pagination"]["count"], 1)
        self.assertIn("hashtags", response.data)
        self.assertIn("suggested_users", response.data)
