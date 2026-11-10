from django.conf import settings
from django.db import models


class Conversation(models.Model):
    class ConversationType(models.TextChoices):
        DIRECT = "direct", "Direct"
        GROUP = "group", "Group"

    participants = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="conversations",
    )

    conversation_type = models.CharField(
        max_length=20,
        choices=ConversationType.choices,
        default=ConversationType.DIRECT,
    )
    name = models.CharField(max_length=100, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_conversations",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        usernames = self.participants.values_list(
            "username",
            flat=True,
        )
        return "Conversation: " + ", ".join(usernames)


class ConversationMember(models.Model):
    class Role(models.TextChoices):
        MEMBER = "member", "Member"
        ADMIN = "admin", "Admin"

    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="conversation_memberships",
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.MEMBER,
    )
    is_muted = models.BooleanField(default=False)
    joined_at = models.DateTimeField(auto_now_add=True)
    last_read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["conversation", "user"],
                name="unique_conversation_member",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "conversation"]),
        ]


class Message(models.Model):
    class AttachmentType(models.TextChoices):
        FILE = "file", "File"
        AUDIO = "audio", "Voice note"
        IMAGE = "image", "Image"
        VIDEO = "video", "Video"

    conversation = models.ForeignKey(
        "Conversation",
        on_delete=models.CASCADE,
        related_name="messages",
    )

    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sent_messages",
    )

    content = models.TextField()

    reply_to = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="replies",
    )
    attachment = models.FileField(
        upload_to="messages/%Y/%m/",
        blank=True,
        null=True,
    )
    attachment_type = models.CharField(
        max_length=10,
        choices=AttachmentType.choices,
        default=AttachmentType.FILE,
    )

    is_read = models.BooleanField(
        default=False,
    )

    is_deleted = models.BooleanField(default=False)
    edited_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(
                fields=[
                    "conversation",
                    "is_read",
                    "-created_at",
                ]
            )
        ]

    def __str__(self):
        return (
            f"{self.sender.username}: "
            f"{self.content[:40]}"
        )