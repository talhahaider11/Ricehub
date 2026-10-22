from .models import BlockedUser
from .models import UserPrivacySettings


def is_blocked_between(user_one, user_two):
    if not user_one or not user_two:
        return False

    return BlockedUser.objects.filter(
        blocker_id__in=[user_one.pk, user_two.pk],
        blocked_id__in=[user_one.pk, user_two.pk],
    ).exists()


def get_blocked_user_ids(user):
    blocked_ids = BlockedUser.objects.filter(
        blocker=user
    ).values_list("blocked_id", flat=True)
    blocking_ids = BlockedUser.objects.filter(
        blocked=user
    ).values_list("blocker_id", flat=True)
    return set(blocked_ids).union(blocking_ids)


def are_friends(user_one, user_two):
    from friendships.services import get_friend_ids

    return user_two.pk in get_friend_ids(user_one)


def can_receive_friend_request(sender, receiver):
    if is_blocked_between(sender, receiver):
        return False
    try:
        audience = receiver.privacy_settings.friend_requests_from
    except UserPrivacySettings.DoesNotExist:
        audience = UserPrivacySettings.Audience.EVERYONE

    if audience == UserPrivacySettings.Audience.NOBODY:
        return False
    if audience == UserPrivacySettings.Audience.FRIENDS_OF_FRIENDS:
        from friendships.services import get_friend_ids

        return bool(
            set(get_friend_ids(sender)).intersection(get_friend_ids(receiver))
        )
    return True


def can_message_between(sender, recipient):
    if is_blocked_between(sender, recipient):
        return False
    try:
        audience = recipient.privacy_settings.messages_from
    except UserPrivacySettings.DoesNotExist:
        audience = UserPrivacySettings.MessageAudience.EVERYONE

    if audience == UserPrivacySettings.MessageAudience.NOBODY:
        return False
    if audience == UserPrivacySettings.MessageAudience.FRIENDS:
        return are_friends(sender, recipient)
    return True
