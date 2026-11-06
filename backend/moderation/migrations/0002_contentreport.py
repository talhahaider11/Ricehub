import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("comments", "0001_initial"),
        ("moderation", "0001_initial"),
        ("posts", "0004_post_post_type"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ContentReport",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "target_type",
                    models.CharField(
                        choices=[("post", "Post"), ("comment", "Comment")],
                        max_length=10,
                    ),
                ),
                ("target_id", models.PositiveBigIntegerField()),
                ("target_text", models.TextField(blank=True)),
                (
                    "reason",
                    models.CharField(
                        choices=[
                            ("spam", "Spam"),
                            ("harassment", "Harassment"),
                            ("hate_speech", "Hate speech"),
                            ("violence", "Violence"),
                            ("nudity", "Nudity"),
                            ("other", "Other"),
                        ],
                        max_length=20,
                    ),
                ),
                ("details", models.TextField(blank=True, max_length=2000)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("open", "Open"),
                            ("reviewed", "Reviewed"),
                            ("action_taken", "Action taken"),
                            ("dismissed", "Dismissed"),
                        ],
                        default="open",
                        max_length=20,
                    ),
                ),
                ("resolution_note", models.TextField(blank=True, max_length=2000)),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "comment",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="content_reports",
                        to="comments.comment",
                    ),
                ),
                (
                    "post",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="content_reports",
                        to="posts.post",
                    ),
                ),
                (
                    "reporter",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="content_reports_sent",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "reviewed_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="content_reports_reviewed",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "target_author",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="content_reports_received",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(
                        fields=["status", "-created_at"],
                        name="moderation__status_4b6062_idx",
                    ),
                    models.Index(
                        fields=["target_type", "target_id"],
                        name="moderation__target__9be8fb_idx",
                    ),
                ],
            },
        ),
        migrations.AddConstraint(
            model_name="contentreport",
            constraint=models.UniqueConstraint(
                fields=("reporter", "target_type", "target_id"),
                name="unique_reporter_content_target",
            ),
        ),
        migrations.AddConstraint(
            model_name="contentreport",
            constraint=models.CheckConstraint(
                check=models.Q(post__isnull=True)
                | models.Q(comment__isnull=True),
                name="content_report_single_relation",
            ),
        ),
    ]
