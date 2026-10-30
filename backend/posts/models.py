from django.conf import settings
from django.db import models
from .validators import validate_post_image, validate_post_video


class Hashtag(models.Model):
    name = models.CharField(
        max_length=100,
        unique=True,
        db_index=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"#{self.name}"


class Post(models.Model):

    class Visibility(models.TextChoices):
        PUBLIC = "public", "Public"
        FRIENDS = "friends", "Friends"
        PRIVATE = "private", "Private"

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="posts",
    )

    content = models.TextField(
        blank=True
    )

    image = models.ImageField(
        upload_to="posts/%Y/%m/",
        blank=True,
        null=True,
        validators=[validate_post_image],
    )

    video = models.FileField(
        upload_to="posts/videos/%Y/%m/",
        blank=True,
        null=True,
        validators=[validate_post_video],
    )

    visibility = models.CharField(
        max_length=20,
        choices=Visibility.choices,
        default=Visibility.PUBLIC,
    )

    hashtags = models.ManyToManyField(
        Hashtag,
        blank=True,
        related_name="posts",
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["-created_at"]),
            models.Index(fields=["author", "-created_at"]),
        ]

    def __str__(self):
        # Username aur content ka truncated preview bina line-break syntax error ke
        preview = self.content[:30] if self.content else "Media Post"
        return f"{self.author.username}: {preview}"