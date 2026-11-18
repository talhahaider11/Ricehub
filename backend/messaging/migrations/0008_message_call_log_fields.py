from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("messaging", "0007_message_call_id"),
    ]

    operations = [
        migrations.AddField(
            model_name="message",
            name="message_type",
            field=models.CharField(
                choices=[("text", "Text"), ("call_log", "Call log")],
                default="text",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="message",
            name="call_status",
            field=models.CharField(
                blank=True,
                choices=[
                    ("completed", "Completed"),
                    ("cancelled", "Cancelled"),
                    ("missed", "Missed"),
                    ("unanswered", "Unanswered"),
                ],
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="message",
            name="call_duration_seconds",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
    ]
