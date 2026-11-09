from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("reactions", "0002_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="reaction",
            name="reaction_type",
            field=models.CharField(
                choices=[
                    ("like", "Like"),
                    ("love", "Love"),
                    ("care", "Care"),
                    ("haha", "Haha"),
                    ("wow", "Wow"),
                    ("sad", "Sad"),
                    ("angry", "Angry"),
                ],
                max_length=20,
            ),
        ),
    ]
