from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("messaging", "0005_conversation_member_archive_delete"),
    ]

    operations = [
        migrations.AddField(
            model_name="conversation",
            name="admins_only",
            field=models.BooleanField(default=False),
        ),
    ]
