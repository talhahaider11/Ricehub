from urllib.parse import parse_qs, urlparse

from datetime import timedelta
from types import SimpleNamespace

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from comments.models import Comment
from friendships.models import FriendRequest
from posts.models import Hashtag, Post
from reactions.models import Reaction
from users.models import BlockedUser, MutedUser

from .models import FeedInteraction
from .ranking import (
    calculate_content_score,
    calculate_engagement_score,
    calculate_post_score,
    calculate_recency_score,
)

User = get_user_model()


class FeedRankingTests(APITestCase):
    def setUp(self):
        self.viewer = User.objects.create_user(
            username="feed-viewer",
            email="feed-viewer@example.com",
            password="test-password",
        )
        self.author = User.objects.create_user(
            username="feed-author",
            email="feed-author@example.com",
            password="test-password",
        )
        self.client.force_authenticate(self.viewer)

    def test_engagement_and_media_scores_follow_feed_weights(self):
        self.assertEqual(calculate_engagement_score(10, 5), 35)
        self.assertEqual(calculate_content_score(True), 5)
        self.assertEqual(calculate_content_score(False), 0)

    def test_recency_score_is_bounded_for_future_posts_and_decays(self):
        now = timezone.now()
        newest_score = calculate_recency_score(now, now=now)
        older_score = calculate_recency_score(
            now - timedelta(hours=24),
            now=now,
        )
        future_score = calculate_recency_score(
            now + timedelta(hours=1),
            now=now,
        )

        self.assertEqual(newest_score, 30)
        self.assertLess(older_score, newest_score)
        self.assertEqual(future_score, newest_score)

    def test_post_score_includes_relationship_engagement_and_media(self):
        post = SimpleNamespace(
            reactions_count=2,
            comments_count=1,
            has_media=True,
            created_at=timezone.now(),
        )

        score = calculate_post_score(post, is_friend=True)

        self.assertGreaterEqual(score, 30 + 5 + 5 + 30)

    def test_active_boost_improves_post_score(self):
        created_at = timezone.now()
        ordinary = SimpleNamespace(
            reactions_count=0,
            comments_count=0,
            has_media=False,
            created_at=created_at,
            boosted_until=None,
        )
        boosted = SimpleNamespace(
            reactions_count=0,
            comments_count=0,
            has_media=False,
            created_at=created_at,
            boosted_until=created_at + timedelta(days=1),
        )

        self.assertGreater(
            calculate_post_score(boosted, is_friend=False),
            calculate_post_score(ordinary, is_friend=False),
        )


class PersonalizedFeedAPITests(APITestCase):
    def setUp(self):
        self.viewer = User.objects.create_user(
            username="feed-viewer",
            email="feed-viewer@example.com",
            password="test-password",
        )
        self.friend = User.objects.create_user(
            username="feed-friend",
            email="feed-friend@example.com",
            password="test-password",
        )
        self.stranger = User.objects.create_user(
            username="feed-stranger",
            email="feed-stranger@example.com",
            password="test-password",
        )
        self.client.force_authenticate(self.viewer)

    def make_friend(self, user):
        FriendRequest.objects.create(
            sender=self.viewer,
            receiver=user,
            status=FriendRequest.Status.ACCEPTED,
        )

    def test_feed_includes_own_and_public_posts_but_hides_private_posts(self):
        own_private = Post.objects.create(
            author=self.viewer,
            content="My private post",
            visibility=Post.Visibility.PRIVATE,
        )
        public = Post.objects.create(
            author=self.stranger,
            content="Public post",
        )
        Post.objects.create(
            author=self.stranger,
            content="Private post",
            visibility=Post.Visibility.PRIVATE,
        )

        response = self.client.get("/api/feed/")

        self.assertEqual(response.status_code, 200)
        result_ids = {item["id"] for item in response.data["results"]}
        self.assertEqual(result_ids, {own_private.id, public.id})
        self.assertEqual(response.data["count"], 2)

    def test_friends_posts_are_only_visible_to_accepted_friends(self):
        friends_post = Post.objects.create(
            author=self.friend,
            content="Friends-only post",
            visibility=Post.Visibility.FRIENDS,
        )

        hidden_response = self.client.get("/api/feed/")
        self.assertNotIn(
            friends_post.id,
            {item["id"] for item in hidden_response.data["results"]},
        )

        self.make_friend(self.friend)
        visible_response = self.client.get("/api/feed/")
        self.assertIn(
            friends_post.id,
            {item["id"] for item in visible_response.data["results"]},
        )

    def test_feed_excludes_blocked_muted_inactive_and_suspended_authors(self):
        blocked = User.objects.create_user(
            username="blocked-author",
            email="blocked-author@example.com",
            password="test-password",
        )
        blocked_by_author = User.objects.create_user(
            username="blocking-author",
            email="blocking-author@example.com",
            password="test-password",
        )
        muted = User.objects.create_user(
            username="muted-author",
            email="muted-author@example.com",
            password="test-password",
        )
        inactive = User.objects.create_user(
            username="inactive-author",
            email="inactive-author@example.com",
            password="test-password",
            is_active=False,
        )
        suspended = User.objects.create_user(
            username="suspended-author",
            email="suspended-author@example.com",
            password="test-password",
            is_suspended=True,
        )
        hidden_posts = [
            Post.objects.create(author=blocked, content="Blocked"),
            Post.objects.create(author=blocked_by_author, content="Blocker"),
            Post.objects.create(author=muted, content="Muted"),
            Post.objects.create(author=inactive, content="Inactive"),
            Post.objects.create(author=suspended, content="Suspended"),
        ]
        BlockedUser.objects.create(blocker=self.viewer, blocked=blocked)
        BlockedUser.objects.create(
            blocker=blocked_by_author,
            blocked=self.viewer,
        )
        MutedUser.objects.create(muter=self.viewer, muted=muted)

        response = self.client.get("/api/feed/")

        self.assertEqual(response.status_code, 200)
        result_ids = {item["id"] for item in response.data["results"]}
        self.assertFalse(result_ids.intersection(post.id for post in hidden_posts))

    def test_engagement_and_personal_interactions_affect_ranked_order(self):
        low_post = Post.objects.create(
            author=self.stranger,
            content="Less engaging",
        )
        high_post = Post.objects.create(
            author=self.friend,
            content="More engaging",
        )
        Reaction.objects.create(
            user=self.stranger,
            post=high_post,
            reaction_type=Reaction.ReactionType.LIKE,
        )
        Comment.objects.create(
            post=high_post,
            author=self.stranger,
            content="A comment",
        )
        Reaction.objects.create(
            user=self.viewer,
            post=Post.objects.create(
                author=self.friend,
                content="Previously liked by viewer",
            ),
            reaction_type=Reaction.ReactionType.LIKE,
        )

        response = self.client.get("/api/feed/")

        result_ids = [item["id"] for item in response.data["results"]]
        self.assertLess(result_ids.index(high_post.id), result_ids.index(low_post.id))

    def test_recent_interactions_boost_posts_from_the_same_author(self):
        interaction_post = Post.objects.create(
            author=self.friend,
            content="Previously interacted with",
            visibility=Post.Visibility.PRIVATE,
        )
        Reaction.objects.create(
            user=self.viewer,
            post=interaction_post,
            reaction_type=Reaction.ReactionType.LIKE,
        )
        personalized_post = Post.objects.create(
            author=self.friend,
            content="From a familiar author",
        )
        newer_post = Post.objects.create(
            author=self.stranger,
            content="From a new author",
        )
        now = timezone.now()
        Post.objects.filter(pk=personalized_post.pk).update(
            created_at=now - timedelta(hours=1)
        )
        Post.objects.filter(pk=newer_post.pk).update(created_at=now)

        response = self.client.get("/api/feed/")

        result_ids = [item["id"] for item in response.data["results"]]
        self.assertLess(
            result_ids.index(personalized_post.id),
            result_ids.index(newer_post.id),
        )

    def test_recent_interactions_boost_posts_with_similar_hashtags(self):
        hashtag = Hashtag.objects.create(name="gardening")
        history_author = User.objects.create_user(
            username="tag-history-author",
            email="tag-history@example.com",
            password="test-password",
        )
        interaction_post = Post.objects.create(
            author=history_author,
            content="Previously interacted with",
            visibility=Post.Visibility.PRIVATE,
        )
        interaction_post.hashtags.add(hashtag)
        Reaction.objects.create(
            user=self.viewer,
            post=interaction_post,
            reaction_type=Reaction.ReactionType.LIKE,
        )
        personalized_post = Post.objects.create(
            author=self.friend,
            content="A familiar topic",
        )
        personalized_post.hashtags.add(hashtag)
        newer_post = Post.objects.create(
            author=self.stranger,
            content="A different topic",
        )
        now = timezone.now()
        Post.objects.filter(pk=personalized_post.pk).update(
            created_at=now - timedelta(hours=1)
        )
        Post.objects.filter(pk=newer_post.pk).update(created_at=now)

        response = self.client.get("/api/feed/")

        result_ids = [item["id"] for item in response.data["results"]]
        self.assertLess(
            result_ids.index(personalized_post.id),
            result_ids.index(newer_post.id),
        )

    def test_feed_requires_authentication_and_supports_pagination(self):
        for index in range(25):
            Post.objects.create(
                author=self.stranger,
                content=f"Post {index}",
            )

        response = self.client.get("/api/feed/?page_size=5")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 5)
        self.assertIsNotNone(response.data["next"])

        self.client.force_authenticate(user=None)
        unauthenticated = self.client.get("/api/feed/")
        self.assertEqual(unauthenticated.status_code, 401)

    def test_for_you_feed_uses_signed_cursor_pagination(self):
        for index in range(23):
            Post.objects.create(
                author=self.stranger,
                content=f"For You cursor post {index}",
            )

        first_page = self.client.get("/api/feed/for-you/")

        self.assertEqual(first_page.status_code, 200)
        self.assertEqual(len(first_page.data["results"]), 20)
        self.assertIsNotNone(first_page.data["next"])
        cursor = parse_qs(urlparse(first_page.data["next"]).query)["cursor"][0]

        second_page = self.client.get(
            "/api/feed/for-you/",
            {"cursor": cursor},
        )

        self.assertEqual(second_page.status_code, 200, second_page.data)
        self.assertEqual(len(second_page.data["results"]), 3)
        self.assertIsNotNone(second_page.data["previous"])
        self.assertFalse(
            {
                item["id"] for item in first_page.data["results"]
            }.intersection(
                item["id"] for item in second_page.data["results"]
            )
        )

    def test_for_you_feed_rejects_invalid_cursor(self):
        response = self.client.get(
            "/api/feed/for-you/?cursor=invalid",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("cursor", response.data)

    def test_primary_feed_supports_cursor_and_keeps_legacy_page_requests(self):
        for index in range(23):
            Post.objects.create(
                author=self.stranger,
                content=f"Primary cursor post {index}",
            )

        first_page = self.client.get("/api/feed/")
        self.assertEqual(first_page.status_code, 200)
        self.assertEqual(len(first_page.data["results"]), 20)
        self.assertIsNotNone(first_page.data["next"])

        cursor = parse_qs(urlparse(first_page.data["next"]).query)["cursor"][0]
        second_page = self.client.get("/api/feed/", {"cursor": cursor})
        self.assertEqual(second_page.status_code, 200, second_page.data)
        self.assertEqual(len(second_page.data["results"]), 3)

        legacy_page = self.client.get("/api/feed/?page=1&page_size=5")
        self.assertEqual(legacy_page.status_code, 200)
        self.assertEqual(len(legacy_page.data["results"]), 5)

    def test_view_tracking_records_once_per_24_hours(self):
        post = Post.objects.create(author=self.stranger, content="View me")

        first_response = self.client.post(f"/api/feed/{post.id}/view/")
        second_response = self.client.post(f"/api/feed/{post.id}/view/")

        self.assertEqual(first_response.status_code, 201)
        self.assertTrue(first_response.data["recorded"])
        self.assertEqual(second_response.status_code, 200)
        self.assertFalse(second_response.data["recorded"])
        self.assertEqual(
            FeedInteraction.objects.filter(
                user=self.viewer,
                post=post,
                interaction_type=FeedInteraction.InteractionType.VIEW,
            ).count(),
            1,
        )

    def test_view_tracking_does_not_disclose_ineligible_posts(self):
        post = Post.objects.create(
            author=self.stranger,
            content="Not visible",
            visibility=Post.Visibility.PRIVATE,
        )

        response = self.client.post(f"/api/feed/{post.id}/view/")

        self.assertEqual(response.status_code, 404)
        self.assertFalse(FeedInteraction.objects.exists())
