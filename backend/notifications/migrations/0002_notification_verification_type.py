from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("notifications", "0002_initial"),
    ]

    operations = [
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
                    ("verification", "Verification"),
                ],
                max_length=30,
            ),
        ),
    ]
