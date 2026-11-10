from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("messaging", "0003_message_attachment_type"),
    ]

    operations = [
        migrations.AlterField(
            model_name="message",
            name="attachment_type",
            field=models.CharField(
                choices=[
                    ("file", "File"),
                    ("audio", "Voice note"),
                    ("image", "Image"),
                    ("video", "Video"),
                ],
                default="file",
                max_length=10,
            ),
        ),
    ]
