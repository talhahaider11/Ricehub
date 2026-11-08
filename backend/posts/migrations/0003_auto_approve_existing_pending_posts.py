from django.db import migrations


def approve_pending_posts(apps, schema_editor):
    Post = apps.get_model("posts", "Post")
    Post.objects.filter(moderation_status="pending").update(
        moderation_status="approved"
    )


class Migration(migrations.Migration):

    dependencies = [
        ("posts", "0002_initial"),
    ]

    operations = [
        migrations.RunPython(approve_pending_posts, migrations.RunPython.noop),
    ]
