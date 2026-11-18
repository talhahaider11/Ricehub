from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("notifications", "0003_notification_subscription_expired"),
    ]

    operations = [
        migrations.AddField(
            model_name="notification",
            name="call_id",
            field=models.UUIDField(blank=True, null=True, unique=True),
        ),
        migrations.AlterField(
            model_name="notification",
            name="notification_type",
            field=models.CharField(
                choices=[
                    ("friend_request", "Friend Request"),
                    ("friend_accepted", "Friend Accepted"),
                    ("comment", "Comment"),
                    ("reaction", "Reaction"),
                    ("message", "Message"),
                    ("event_invitation", "Event Invitation"),
                    ("voice_call", "Voice Call"),
                    ("verification", "Verification"),
                    ("subscription_expired", "Subscription Expired"),
                ],
                max_length=30,
            ),
        ),
    ]
