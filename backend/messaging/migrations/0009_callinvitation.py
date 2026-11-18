import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("messaging", "0008_message_call_log_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="CallInvitation",
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
                ("call_id", models.UUIDField(unique=True)),
                ("offer", models.JSONField()),
                (
                    "state",
                    models.CharField(
                        choices=[
                            ("ringing", "Ringing"),
                            ("answered", "Answered"),
                            ("ended", "Ended"),
                        ],
                        default="ringing",
                        max_length=12,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "caller",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="outgoing_call_invitations",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "conversation",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="call_invitations",
                        to="messaging.conversation",
                    ),
                ),
                (
                    "recipient",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="incoming_call_invitations",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.AddIndex(
            model_name="callinvitation",
            index=models.Index(
                fields=["recipient", "state", "created_at"],
                name="messaging_c_recipie_e027a8_idx",
            ),
        ),
    ]
