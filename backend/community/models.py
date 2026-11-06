from datetime import timedelta

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from posts.validators import validate_post_image, validate_post_video


def story_expiry_default():
    return timezone.now() + timedelta(hours=24)


class Story(models.Model):
    class Visibility(models.TextChoices):
        PUBLIC = "public", "Public"
        FRIENDS = "friends", "Friends"

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="stories",
    )
    text = models.CharField(max_length=500, blank=True)
    media = models.FileField(upload_to="stories/%Y/%m/", blank=True)
    image = models.ImageField(
        upload_to="stories/images/%Y/%m/",
        blank=True,
        null=True,
        validators=[validate_post_image],
    )
    video = models.FileField(
        upload_to="stories/videos/%Y/%m/",
        blank=True,
        null=True,
        validators=[validate_post_video],
    )
    media_asset = models.ForeignKey(
        "media.MediaAsset",
        on_delete=models.SET_NULL,
        related_name="stories",
        blank=True,
        null=True,
    )
    visibility = models.CharField(
        max_length=20,
        choices=Visibility.choices,
        default=Visibility.FRIENDS,
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(
        default=story_expiry_default,
        db_index=True,
    )

class Meta:
    ordering = ["-created_at"]
    indexes = [
        models.Index(
            fields=["author", "-created_at"],
            name="comm_story_author_created_idx",
        ),
        models.Index(
            fields=["visibility", "expires_at"],
            name="comm_story_visibility_exp_idx",
        ),
    ]
    constraints = [
        models.CheckConstraint(
            check=~(models.Q(image__isnull=False) & ~models.Q(image="") & models.Q(video__isnull=False) & ~models.Q(video="")),  # <-- 'condition=' ko 'check=' se replace kar diya hai
            name="story_one_media_type",
        ),
    ]

    @property
    def caption(self):
        return self.text

    @caption.setter
    def caption(self, value):
        self.text = value

    @property
    def is_expired(self):
        return timezone.now() >= self.expires_at


class StoryView(models.Model):
    story = models.ForeignKey(
        Story,
        on_delete=models.CASCADE,
        related_name="views",
    )
    viewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="story_views",
    )
    viewed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["story", "viewer"],
                name="unique_story_viewer",
            )
        ]
        indexes = [
            models.Index(
                fields=["viewer", "-viewed_at"],
                name="comm_storyview_viewer_date_idx",
            ),
            models.Index(
                fields=["story", "-viewed_at"],
                name="comm_storyview_story_date_idx",
            ),
        ]


class Community(models.Model):
    class Kind(models.TextChoices):
        GROUP = "group", "Group"
        PAGE = "page", "Page"

    class Visibility(models.TextChoices):
        PUBLIC = "public", "Public"
        PRIVATE = "private", "Private"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="owned_communities",
    )
    name = models.CharField(max_length=100)
    description = models.TextField(max_length=2000, blank=True)
    kind = models.CharField(max_length=10, choices=Kind.choices)
    visibility = models.CharField(
        max_length=10,
        choices=Visibility.choices,
        default=Visibility.PUBLIC,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class CommunityMembership(models.Model):
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        MEMBER = "member", "Member"

    community = models.ForeignKey(
        Community,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="community_memberships",
    )
    role = models.CharField(
        max_length=10,
        choices=Role.choices,
        default=Role.MEMBER,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["community", "user"],
                name="unique_community_membership",
            )
        ]


class CommunityPost(models.Model):
    community = models.ForeignKey(
        Community,
        on_delete=models.CASCADE,
        related_name="posts",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="community_posts",
    )
    content = models.TextField(max_length=5000, blank=True)
    image = models.ImageField(upload_to="community/posts/%Y/%m/", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class Event(models.Model):
    class Response(models.TextChoices):
        GOING = "going", "Going"
        INTERESTED = "interested", "Interested"

    host = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="hosted_events",
    )
    community = models.ForeignKey(
        Community,
        on_delete=models.SET_NULL,
        related_name="events",
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=160)
    description = models.TextField(max_length=4000, blank=True)
    location = models.CharField(max_length=255, blank=True)
    starts_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["starts_at", "id"]


class EventAttendance(models.Model):
    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name="attendances",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="event_attendances",
    )
    response = models.CharField(max_length=12, choices=Event.Response.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["event", "user"],
                name="unique_event_attendance",
            )
        ]


class EventInvitation(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        DECLINED = "declined", "Declined"

    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name="invitations",
    )
    inviter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sent_event_invitations",
    )
    invitee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="received_event_invitations",
    )
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["event", "invitee"],
                name="unique_event_invitation",
            )
        ]


class MarketplaceListing(models.Model):
    class Status(models.TextChoices):
        AVAILABLE = "available", "Available"
        SOLD = "sold", "Sold"

    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="marketplace_listings",
    )
    title = models.CharField(max_length=160)
    description = models.TextField(max_length=3000, blank=True)
    price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0)],
    )
    location = models.CharField(max_length=255, blank=True)
    image = models.ImageField(upload_to="marketplace/%Y/%m/", blank=True)
    status = models.CharField(
        max_length=12,
        choices=Status.choices,
        default=Status.AVAILABLE,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class MarketplaceOrder(models.Model):
    class Status(models.TextChoices):
        REQUESTED = "requested", "Requested"
        ACCEPTED = "accepted", "Accepted"
        DECLINED = "declined", "Declined"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    listing = models.ForeignKey(
        MarketplaceListing,
        on_delete=models.PROTECT,
        related_name="orders",
    )
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="marketplace_orders",
    )
    status = models.CharField(
        max_length=12,
        choices=Status.choices,
        default=Status.REQUESTED,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["listing", "buyer"],
                condition=models.Q(
                    status__in=["requested", "accepted"],
                ),
                name="one_active_order_per_buyer_listing",
            )
        ]
