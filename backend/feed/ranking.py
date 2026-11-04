from math import exp

from django.db.models import Count
from django.utils import timezone

from .constants import (
    BASE_RELATIONSHIP_SCORE,
    COMMENT_WEIGHT,
    FOLLOWING_SCORE,
    FRIEND_SCORE,
    MAX_PERSONALIZATION_SCORE,
    MEDIA_SCORE,
    RECENCY_HALF_LIFE_HOURS,
    RECENCY_MAX_SCORE,
    REACTION_WEIGHT,
)
from .interaction_service import (
    get_personalization_signals,
    get_user_interaction_weights,
)


def calculate_recency_score(created_at, now=None):
    now = now or timezone.now()
    age_hours = max((now - created_at).total_seconds() / 3600, 0)
    return RECENCY_MAX_SCORE * exp(
        -age_hours / RECENCY_HALF_LIFE_HOURS
    )


def calculate_engagement_score(reaction_count, comment_count):
    return (
        reaction_count * REACTION_WEIGHT
        + comment_count * COMMENT_WEIGHT
    )


def calculate_relationship_score(is_friend, is_following=False):
    return (
        BASE_RELATIONSHIP_SCORE
        + (FRIEND_SCORE if is_friend else 0)
        + (FOLLOWING_SCORE if is_following else 0)
    )


def calculate_content_score(has_media):
    return MEDIA_SCORE if has_media else 0


def calculate_post_score(
    post,
    is_friend,
    is_following=False,
    author_interaction_count=0,
    hashtag_interaction_weights=None,
):
    reaction_count = getattr(
        post,
        "reactions_count",
        getattr(post, "reaction_count", 0),
    )
    comment_count = getattr(
        post,
        "comments_count",
        getattr(post, "comment_count", 0),
    )
    media_score = calculate_content_score(
        getattr(
            post,
            "has_media",
            bool(
                getattr(post, "image", None)
                or getattr(post, "video", None)
            ),
        )
    )
    hashtag_interaction_weights = hashtag_interaction_weights or {}
    hashtags = getattr(post, "feed_hashtags", None)
    if hashtags is None:
        hashtag_relation = getattr(post, "hashtags", [])
        hashtags = (
            hashtag_relation.all()
            if hasattr(hashtag_relation, "all")
            else hashtag_relation
        )
    hashtag_score = sum(
        hashtag_interaction_weights.get(hashtag.name.casefold(), 0)
        for hashtag in hashtags
    )
    personalization_score = min(
        MAX_PERSONALIZATION_SCORE,
        author_interaction_count + hashtag_score,
    )
    boosted_until = getattr(post, "boosted_until", None)
    boost_score = (
        100
        if boosted_until and boosted_until > timezone.now()
        else 0
    )
    return (
        calculate_relationship_score(is_friend, is_following)
        + calculate_engagement_score(reaction_count, comment_count)
        + calculate_recency_score(post.created_at)
        + media_score
        + personalization_score
        + boost_score
    )
