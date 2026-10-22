from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
from .validators import validate_profile_image


class Meta:
    indexes = [
        models.Index(fields=["username"]),
        models.Index(fields=["email"]),
    ]
    
class ProfileVisibility(models.TextChoices):
    PUBLIC = "public", "Public"
    FRIENDS = "friends", "Friends"
    PRIVATE = "private", "Private"


class User(AbstractUser):
    email = models.EmailField(unique=True)
    is_email_verified = models.BooleanField(default=True)

    profile_visibility = models.CharField(
    max_length=20,
    choices=ProfileVisibility.choices,
    default=ProfileVisibility.PUBLIC,
    )

    username = models.CharField(
        max_length=150,
        unique=True
    )

    first_name = models.CharField(
        max_length=100,
        blank=True
    )

    last_name = models.CharField(
        max_length=100,
        blank=True
    )

    bio = models.TextField(
        blank=True
    )

    profile_picture = models.ImageField(
        upload_to="profiles/",
        blank=True,
        null=True
    )

    cover_picture = models.ImageField(
        upload_to="covers/",
        blank=True,
        null=True
    )

    location = models.CharField(
        max_length=255,
        blank=True
    )

    website = models.URLField(
        blank=True
    )

    date_of_birth = models.DateField(
        blank=True,
        null=True
    )

    is_online = models.BooleanField(
        default=False
    )

    last_seen = models.DateTimeField(
        blank=True,
        null=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    def __str__(self):
        return self.username


class UserPrivacySettings(models.Model):
    class Audience(models.TextChoices):
        EVERYONE = "everyone", "Everyone"
        FRIENDS_OF_FRIENDS = "friends_of_friends", "Friends of friends"
        NOBODY = "nobody", "Nobody"

    class MessageAudience(models.TextChoices):
        EVERYONE = "everyone", "Everyone"
        FRIENDS = "friends", "Friends"
        NOBODY = "nobody", "Nobody"

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="privacy_settings",
    )
    friend_requests_from = models.CharField(
        max_length=20,
        choices=Audience.choices,
        default=Audience.EVERYONE,
    )
    messages_from = models.CharField(
        max_length=12,
        choices=MessageAudience.choices,
        default=MessageAudience.EVERYONE,
    )
    discoverable_by_email = models.BooleanField(default=False)
    show_activity_status = models.BooleanField(default=True)
    show_last_seen = models.BooleanField(default=True)
    read_receipts = models.BooleanField(default=True)


class BlockedUser(models.Model):
    blocker = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="blocked_users",
    )
    blocked = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="blocked_by_users",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["blocker", "blocked"],
                name="unique_user_block",
            ),
            models.CheckConstraint(
                condition=~models.Q(blocker=models.F("blocked")),
                name="cannot_block_self",
            ),
        ]


class TwoFactorChallenge(models.Model):
    class Purpose(models.TextChoices):
        LOGIN = "login", "Login"
        ENABLE = "enable", "Enable two-step verification"

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="two_factor_challenge",
    )
    code_hash = models.CharField(max_length=128)
    purpose = models.CharField(
        max_length=10,
        choices=Purpose.choices,
        default=Purpose.LOGIN,
    )
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now=True)


class UserSecuritySettings(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="security_settings",
    )
    two_factor_enabled = models.BooleanField(default=False)


class EmailVerification(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="email_verification",
    )
    code_hash = models.CharField(max_length=128, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    last_sent_at = models.DateTimeField(null=True, blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)

    def is_expired(self):
        return not self.expires_at or timezone.now() >= self.expires_at

profile_picture = models.ImageField(
    upload_to="profiles/",
    blank=True,
    null=True,
    validators=[
        validate_profile_image
    ],
)

cover_picture = models.ImageField(
    upload_to="covers/",
    blank=True,
    null=True,
    validators=[
        validate_profile_image
    ],
)
