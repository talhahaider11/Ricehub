from django.db import migrations
from django.db.models import Count


def backfill_posts_created(apps, schema_editor):
    User = apps.get_model("users", "User")
    Post = apps.get_model("posts", "Post")
    database = schema_editor.connection.alias

    post_counts = (
        Post.objects.using(database)
        .values("author_id")
        .annotate(total=Count("id"))
    )
    for row in post_counts.iterator():
        User.objects.using(database).filter(pk=row["author_id"]).update(
            posts_created=row["total"]
        )


class Migration(migrations.Migration):

    dependencies = [
        ("posts", "0006_post_boosted_until_post_moderation_status"),
        ("users", "0011_user_is_phone_verified_user_is_verified_and_more"),
    ]

    operations = [
        migrations.RunPython(backfill_posts_created, migrations.RunPython.noop),
    ]
