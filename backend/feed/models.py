from django.conf import settings
from django.db import models


class FeedInteraction(models.Model):
    class InteractionType(models.TextChoices):
        VIEW = "view", "View"
        LIKE = "like", "Like"
        COMMENT = "comment", "Comment"
        SHARE = "share", "Share"
        SAVE = "save", "Save"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="feed_interactions",
    )
    post = models.ForeignKey(
        "posts.Post",
        on_delete=models.CASCADE,
        related_name="feed_interactions",
    )
    interaction_type = models.CharField(
        max_length=20,
        choices=InteractionType.choices,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(
                fields=["user", "created_at"],
                name="feed_user_created_idx",
            ),
            models.Index(
                fields=["post", "interaction_type"],
                name="feed_post_type_idx",
            ),
            models.Index(
                fields=["user", "post", "interaction_type", "created_at"],
                name="feed_view_lookup_idx",
            ),
        ]
