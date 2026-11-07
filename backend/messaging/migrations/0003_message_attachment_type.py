from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("messaging", "0002_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="message",
            name="attachment_type",
            field=models.CharField(
                choices=[("file", "File"), ("audio", "Voice note")],
                default="file",
                max_length=10,
            ),
        ),
    ]
