import posts.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("community", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="event",
            name="ends_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="event",
            name="banner",
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to="events/%Y/%m/",
                validators=[posts.validators.validate_post_image],
            ),
        ),
    ]
