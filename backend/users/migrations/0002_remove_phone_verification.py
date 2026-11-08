from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="user",
            name="phone_number",
        ),
        migrations.RemoveField(
            model_name="user",
            name="is_phone_verified",
        ),
        migrations.RemoveField(
            model_name="userprivacysettings",
            name="discoverable_by_phone",
        ),
        migrations.DeleteModel(
            name="PhoneVerification",
        ),
    ]
