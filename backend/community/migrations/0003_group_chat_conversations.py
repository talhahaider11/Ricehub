from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("community", "0002_initial"),
        ("messaging", "0004_message_image_video_attachments"),
    ]

    operations = [
        migrations.AddField(
            model_name="community",
            name="conversation",
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="community",
                to="messaging.conversation",
            ),
        ),
    ]
