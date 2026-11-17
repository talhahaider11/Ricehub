from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("messaging", "0006_conversation_admins_only"),
    ]

    operations = [
        migrations.AddField(
            model_name="message",
            name="call_id",
            field=models.UUIDField(blank=True, null=True, unique=True),
        ),
    ]
