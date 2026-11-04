from django.conf import settings
from django.db import models


class Notification(models.Model):

    class NotificationType(models.TextChoices):
        FRIEND_REQUEST = (
            "friend_request",
            "Friend Request"
        )
        FRIEND_ACCEPTED = (
            "friend_accepted",
            "Friend Accepted"
        )
        COMMENT = (
            "comment",
            "Comment"
        )
        REACTION = (
            "reaction",
            "Reaction"
        )
        MESSAGE = (
            "message",
            "Message"
        )
        EVENT_INVITATION = (
            "event_invitation",
            "Event Invitation"
        )

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )

    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sent_notifications",
    )

    notification_type = models.CharField(
        max_length=30,
        choices=NotificationType.choices,
    )

    message = models.CharField(
        max_length=255
    )

    post_id = models.PositiveIntegerField(
        null=True,
        blank=True
    )

    comment_id = models.PositiveIntegerField(
        null=True,
        blank=True
    )

    conversation_id = models.PositiveIntegerField(
        null=True,
        blank=True
    )

    is_read = models.BooleanField(
        default=False
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=[
                    "recipient",
                    "is_read",
                    "-created_at",
                ]
            )
        ]

    def __str__(self):
        return f"{self.recipient.username}: {self.message}"


class UserDevice(models.Model):
    PLATFORM_CHOICES = (
        ("android", "Android"),
        ("ios", "iOS"),
        ("web", "Web"),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="devices",
    )

    token = models.TextField(
        unique=True
    )

    platform = models.CharField(
        max_length=20,
        choices=PLATFORM_CHOICES,
        default="android",
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        ordering = ["-updated_at"]
        verbose_name = "User Device"
        verbose_name_plural = "User Devices"

    def __str__(self):
        return f"{self.user.username} - {self.platform}"


class NotificationPreference(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_preferences",
    )
    friend_requests = models.BooleanField(default=True)
    friend_accepted = models.BooleanField(default=True)
    comments = models.BooleanField(default=True)
    reactions = models.BooleanField(default=True)
    messages = models.BooleanField(default=True)
    event_invitations = models.BooleanField(default=True)
    all_notifications = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.user.username}'s Notification Preferences"


class PushDeliveryLog(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"

    notification = models.ForeignKey(
        Notification,
        on_delete=models.CASCADE,
        related_name="push_deliveries",
    )
    device = models.ForeignKey(
        UserDevice,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="push_deliveries",
    )
    token_hash = models.CharField(max_length=64)
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING,
    )
    attempts = models.PositiveSmallIntegerField(default=0)
    error_code = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["notification", "device"],
                name="unique_notification_push_device",
            ),
        ]
        indexes = [
            models.Index(fields=["status", "-created_at"]),
        ]

    def __str__(self):
        return f"Notification {self.notification_id}: {self.status}"