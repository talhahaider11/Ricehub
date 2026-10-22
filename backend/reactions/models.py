from django.conf import settings
from django.db import models


class Reaction(models.Model):

    class ReactionType(models.TextChoices):
        LIKE = "like", "Like"
        LOVE = "love", "Love"
        HAHA = "haha", "Haha"
        WOW = "wow", "Wow"
        SAD = "sad", "Sad"
        ANGRY = "angry", "Angry"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reactions",
    )

    post = models.ForeignKey(
        "posts.Post",
        on_delete=models.CASCADE,
        related_name="reactions",
    )

    reaction_type = models.CharField(
        max_length=20,
        choices=ReactionType.choices,
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "post"],
                name="unique_user_post_reaction",
            )
        ]

    def __str__(self):
        return (
            f"{self.user.username} "
            f"{self.reaction_type} "
            f"post {self.post_id}"
        )