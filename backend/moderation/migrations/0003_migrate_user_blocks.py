from django.db import migrations
from django.db.models import F


def migrate_user_blocks(apps, schema_editor):
    LegacyBlock = apps.get_model("moderation", "UserBlock")
    BlockedUser = apps.get_model("users", "BlockedUser")
    database = schema_editor.connection.alias

    for blocker_id, blocked_id, created_at in (
        LegacyBlock.objects.using(database)
        .exclude(blocker_id=F("blocked_id"))
        .values_list("blocker_id", "blocked_id", "created_at")
        .iterator()
    ):
        block, created = BlockedUser.objects.using(database).get_or_create(
            blocker_id=blocker_id,
            blocked_id=blocked_id,
        )
        if created:
            BlockedUser.objects.using(database).filter(pk=block.pk).update(
                created_at=created_at
            )


def restore_legacy_user_blocks(apps, schema_editor):
    BlockedUser = apps.get_model("users", "BlockedUser")
    LegacyBlock = apps.get_model("moderation", "UserBlock")
    database = schema_editor.connection.alias

    for blocker_id, blocked_id, created_at in (
        BlockedUser.objects.using(database)
        .values_list("blocker_id", "blocked_id", "created_at")
        .iterator()
    ):
        block, created = LegacyBlock.objects.using(database).get_or_create(
            blocker_id=blocker_id,
            blocked_id=blocked_id,
        )
        if created:
            LegacyBlock.objects.using(database).filter(pk=block.pk).update(
                created_at=created_at
            )


class Migration(migrations.Migration):
    dependencies = [
        ("moderation", "0002_contentreport"),
        ("users", "0008_muteduser_accountreport"),
    ]

    operations = [
        migrations.RunPython(
            migrate_user_blocks,
            restore_legacy_user_blocks,
        ),
        migrations.DeleteModel(name="UserBlock"),
    ]
