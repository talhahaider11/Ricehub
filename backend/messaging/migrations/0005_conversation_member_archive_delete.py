from django.db import migrations, models


def create_existing_memberships(apps, schema_editor):
    Conversation = apps.get_model("messaging", "Conversation")
    ConversationMember = apps.get_model("messaging", "ConversationMember")
    database = schema_editor.connection.alias

    for conversation in Conversation.objects.using(database).all().iterator():
        participant_ids = conversation.participants.using(database).values_list(
            "pk",
            flat=True,
        )
        ConversationMember.objects.using(database).bulk_create(
            [
                ConversationMember(
                    conversation_id=conversation.pk,
                    user_id=user_id,
                )
                for user_id in participant_ids
            ],
            ignore_conflicts=True,
        )


class Migration(migrations.Migration):

    dependencies = [
        ("messaging", "0004_message_image_video_attachments"),
    ]

    operations = [
        migrations.AddField(
            model_name="conversationmember",
            name="is_archived",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="conversationmember",
            name="deleted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(
            create_existing_memberships,
            migrations.RunPython.noop,
        ),
    ]
