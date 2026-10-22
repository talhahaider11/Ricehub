from django.contrib.auth import get_user_model
from notifications.services import create_notification

from .models import Conversation
from users.privacy import can_message_between


User = get_user_model()


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
            return conversation, False

    conversation = Conversation.objects.create()

    conversation.participants.add(
        user_one,
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