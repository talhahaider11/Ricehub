from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import Notification, NotificationPreference


def create_notification(
    recipient,
    notification_type,
    message,
    sender=None,
    post_id=None,
    comment_id=None,
    conversation_id=None,
):
    # Don't notify the user about their own action
    if sender and recipient == sender:
        return None

    preferences = NotificationPreference.objects.filter(
        user=recipient
    ).first()
    if preferences and not preferences.all_notifications:
        return None

    preference_field = {
        Notification.NotificationType.FRIEND_REQUEST: "friend_requests",
        Notification.NotificationType.FRIEND_ACCEPTED: "friend_accepted",
        Notification.NotificationType.COMMENT: "comments",
        Notification.NotificationType.REACTION: "reactions",
        Notification.NotificationType.MESSAGE: "messages",
        Notification.NotificationType.EVENT_INVITATION: "event_invitations",
    }.get(notification_type)
    if preference_field and not getattr(
        preferences,
        preference_field,
        True,
    ):
        return None

    # Create notification in database
    notification = Notification.objects.create(
        recipient=recipient,
        sender=sender,
        notification_type=notification_type,
        message=message,
        post_id=post_id,
        comment_id=comment_id,
        conversation_id=conversation_id,
    )

    # Send real-time notification through WebSocket
    channel_layer = get_channel_layer()

    async_to_sync(
        channel_layer.group_send
    )(
        f"notifications_{recipient.id}",
        {
            "type": "notification",
            "notification": {
                "id": notification.id,
                "type": notification.notification_type,
                "message": notification.message,
                "sender_id": (
                    sender.id
                    if sender
                    else None
                ),
                "post_id": notification.post_id,
                "comment_id": notification.comment_id,
                "conversation_id": (
                    notification.conversation_id
                ),
                "created_at": (
                    notification.created_at.isoformat()
                ),
            },
        },
    )

    return notification