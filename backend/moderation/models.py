from django.conf import settings
from django.db import models
from django.db.models import Q


class ContentReport(models.Model):
    class TargetType(models.TextChoices):
        POST = "post", "Post"
        COMMENT = "comment", "Comment"

    class Reason(models.TextChoices):
        SPAM = "spam", "Spam"
        HARASSMENT = "harassment", "Harassment"
        HATE_SPEECH = "hate_speech", "Hate speech"
        VIOLENCE = "violence", "Violence"
        NUDITY = "nudity", "Nudity"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        REVIEWED = "reviewed", "Reviewed"
        ACTION_TAKEN = "action_taken", "Action taken"
        DISMISSED = "dismissed", "Dismissed"

    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="content_reports_sent",
    )
    target_type = models.CharField(max_length=10, choices=TargetType.choices)
    target_id = models.PositiveBigIntegerField()
    post = models.ForeignKey(
        "posts.Post",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="content_reports",
    )
    comment = models.ForeignKey(
        "comments.Comment",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="content_reports",
    )
    target_author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="content_reports_received",
    )
    target_text = models.TextField(blank=True)
    reason = models.CharField(max_length=20, choices=Reason.choices)
    details = models.TextField(blank=True, max_length=2000)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.OPEN,
    )
    resolution_note = models.TextField(blank=True, max_length=2000)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="content_reports_reviewed",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class Meta:
    ordering = ["-created_at"]
    indexes = [
        models.Index(
            fields=["status", "created_at"],
            name="mod_report_status_created_idx",
        ),
    ]
    constraints = [
            models.CheckConstraint(
                condition=~(
                    models.Q(target_post__isnull=True)
                    & models.Q(target_comment__isnull=True)
                    & models.Q(target_story__isnull=True)
                    & models.Q(target_user__isnull=True)
                ),  # <-- Class 'models.CheckConstraint' aur kwarg 'condition='
                name="report_must_have_target",
            ),
        ]

    def __str__(self):
        return f"{self.target_type} #{self.target_id} reported by {self.reporter}"


class AdminActionLog(models.Model):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="moderation_actions",
    )
    action = models.CharField(max_length=50)
    target_type = models.CharField(max_length=50)
    target_id = models.PositiveBigIntegerField(null=True, blank=True)
    reason = models.TextField(blank=True, max_length=2000)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["target_type", "target_id", "-created_at"],
                name="mod_action_target_idx",
            ),
        ]

    def __str__(self):
        return f"{self.action}: {self.target_type} #{self.target_id}"
