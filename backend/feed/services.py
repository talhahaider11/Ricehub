from django.db.models import Case, Count, IntegerField, Prefetch, Value, When
from django.utils import timezone

from friendships.services import get_friend_ids
from posts.models import Post
from reactions.models import Reaction
from users.privacy import filter_visible_posts

from .constants import FEED_CANDIDATE_LIMIT
from .cache import get_cached_feed, set_cached_feed
from .ranking import calculate_post_score, get_personalization_signals


def get_eligible_posts(user):
    return (
        filter_visible_posts(user)
        .select_related("author")
        .prefetch_related(
            Prefetch(
                "reactions",
                queryset=Reaction.objects.filter(user=user),
                to_attr="current_user_reactions",
            ),
            "hashtags",
            "media_assets",
        )
        .annotate(
            comments_count=Count("comments", distinct=True),
            reactions_count=Count("reactions", distinct=True),
        )
        .annotate(
            boost_priority=Case(
                When(boosted_until__gt=timezone.now(), then=Value(1)),
                default=Value(0),
                output_field=IntegerField(),
            )
        )
        .order_by("-boost_priority", "-created_at", "-pk")
    )


def rank_posts(posts, user):
    friend_ids = set(get_friend_ids(user))
    author_weights, hashtag_weights = get_personalization_signals(user)
    ranked_posts = [
        (
            calculate_post_score(
                post,
                is_friend=post.author_id in friend_ids,
                author_interaction_count=author_weights.get(
                    post.author_id,
                    0,
                ),
                hashtag_interaction_weights=hashtag_weights,
            ),
            post,
        )
        for post in posts
    ]
    ranked_posts.sort(
        key=lambda item: (item[0], item[1].created_at, item[1].pk),
        reverse=True,
    )
    return [post for _, post in ranked_posts]


def get_ranked_feed(user, candidate_limit=FEED_CANDIDATE_LIMIT):
    candidates = list(get_eligible_posts(user)[:candidate_limit])
    ranked_posts = rank_posts(candidates, user)
    current_post_ids = [post.pk for post in ranked_posts]

    cached_post_ids = get_cached_feed(user.pk, candidate_limit)
    if cached_post_ids == current_post_ids:
        return ranked_posts

    set_cached_feed(user.pk, candidate_limit, current_post_ids)
    return ranked_posts
