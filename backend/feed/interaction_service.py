from datetime import timedelta

from django.db.models import Count
from django.utils import timezone

from comments.models import Comment
from reactions.models import Reaction

from .constants import INTERACTION_LOOKBACK_DAYS
from .models import FeedInteraction


def get_user_interaction_weights(user):
    interactions = (
        user.feed_interactions
        .values("interaction_type")
        .annotate(count=Count("id"))
    )
    return {
        item["interaction_type"]: item["count"]
        for item in interactions
    }


def get_personalization_signals(user):
    cutoff = timezone.now() - timedelta(days=INTERACTION_LOOKBACK_DAYS)
    author_weights = {}
    hashtag_weights = {}
    interaction_querysets = (
        (Reaction.objects.filter(user=user, created_at__gte=cutoff), 2),
        (Comment.objects.filter(author=user, created_at__gte=cutoff), 3),
        (
            FeedInteraction.objects.filter(
                user=user,
                interaction_type=FeedInteraction.InteractionType.VIEW,
                created_at__gte=cutoff,
            ),
            1,
        ),
    )

    for interaction_queryset, weight in interaction_querysets:
        author_counts = (
            interaction_queryset
            .values("post__author_id")
            .annotate(count=Count("post_id", distinct=True))
        )
        for item in author_counts:
            author_id = item["post__author_id"]
            author_weights[author_id] = (
                author_weights.get(author_id, 0) + item["count"] * weight
            )

        hashtag_counts = (
            interaction_queryset
            .values("post__hashtags__name")
            .annotate(count=Count("post_id", distinct=True))
        )
        for item in hashtag_counts:
            name = item["post__hashtags__name"]
            if name:
                normalized_name = name.casefold()
                hashtag_weights[normalized_name] = (
                    hashtag_weights.get(normalized_name, 0)
                    + item["count"] * weight
                )

    return author_weights, hashtag_weights
