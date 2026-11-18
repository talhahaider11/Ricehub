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
    admins_only = models.BooleanField(default=False)
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
    is_archived = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
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
    class MessageType(models.TextChoices):
        TEXT = "text", "Text"
        CALL_LOG = "call_log", "Call log"

    class CallStatus(models.TextChoices):
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"
        MISSED = "missed", "Missed"
        UNANSWERED = "unanswered", "Unanswered"

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
    message_type = models.CharField(
        max_length=20,
        choices=MessageType.choices,
        default=MessageType.TEXT,
    )
    call_id = models.UUIDField(
        null=True,
        blank=True,
        unique=True,
    )
    call_status = models.CharField(
        max_length=20,
        choices=CallStatus.choices,
        blank=True,
    )
    call_duration_seconds = models.PositiveIntegerField(null=True, blank=True)

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


class CallInvitation(models.Model):
    class State(models.TextChoices):
        RINGING = "ringing", "Ringing"
        ANSWERED = "answered", "Answered"
        ENDED = "ended", "Ended"

    call_id = models.UUIDField(unique=True)
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="call_invitations",
    )
    caller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="outgoing_call_invitations",
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="incoming_call_invitations",
    )
    offer = models.JSONField()
    state = models.CharField(
        max_length=12,
        choices=State.choices,
        default=State.RINGING,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["recipient", "state", "created_at"]),
        ]