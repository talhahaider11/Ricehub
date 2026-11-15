from django.contrib.auth import get_user_model
from notifications.services import create_notification

from .models import Conversation, ConversationMember
from users.privacy import can_message_between


User = get_user_model()


def ensure_conversation_memberships(conversations, user):
    conversation_ids = list(
        conversations.values_list("pk", flat=True)
    )
    existing_ids = set(
        ConversationMember.objects.filter(
            conversation_id__in=conversation_ids,
            user=user,
        ).values_list("conversation_id", flat=True)
    )
    ConversationMember.objects.bulk_create(
        [
            ConversationMember(conversation_id=conversation_id, user=user)
            for conversation_id in conversation_ids
            if conversation_id not in existing_ids
        ],
        ignore_conflicts=True,
    )


def restore_conversation_memberships(conversation):
    conversation.memberships.filter(deleted_at__isnull=False).update(
        deleted_at=None,
        is_archived=False,
    )


def get_or_create_conversation(
    user_one,
    user_two,
):
    if user_one == user_two:
        raise ValueError(
            "A user cannot message themselves."
        )
    if not can_message_between(user_one, user_two):
        raise ValueError("This person is not accepting messages from you.")

    conversations = (
        Conversation.objects
        .filter(participants=user_one)
        .filter(participants=user_two)
    )

    for conversation in conversations:

        if conversation.participants.count() == 2:
            ensure_conversation_memberships(
                Conversation.objects.filter(pk=conversation.pk),
                user_one,
            )
            ensure_conversation_memberships(
                Conversation.objects.filter(pk=conversation.pk),
                user_two,
            )
            return conversation, False

    conversation = Conversation.objects.create()

    conversation.participants.add(
        user_one,
        user_two,
    )
    ensure_conversation_memberships(
        Conversation.objects.filter(pk=conversation.pk),
        user_one,
    )
    ensure_conversation_memberships(
        Conversation.objects.filter(pk=conversation.pk),
        user_two,
    )

    return conversation, True

from notifications.services import (
    create_notification
)


def notify_new_message(
    conversation,
    sender,
):
    recipients = conversation.participants.exclude(
        id=sender.id
    )

    for recipient in recipients:
        create_notification(
            recipient=recipient,
            sender=sender,
            notification_type="message",
            message=(
                f"{sender.username} sent you a message."
            ),
            conversation_id=conversation.id,
        )