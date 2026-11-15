# Generated for story likes.
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("community", "0001_initial"),
        ("stories", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="StoryLike",
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
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "story",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="likes",
                        to="community.story",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="story_likes",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(
                        fields=("story", "user"),
                        name="unique_story_like",
                    )
                ],
                "indexes": [
                    models.Index(
                        fields=["story", "-created_at"],
                        name="story_like_story_date_idx",
                    )
                ],
            },
        ),
    ]
