from django.db.models import Q
from django.utils import timezone

from .models import BlockedUser, MutedUser, UserPrivacySettings


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


def get_muted_user_ids(user):
    return set(
        MutedUser.objects.filter(muter=user).values_list("muted_id", flat=True)
    )


def can_view_post(user, post):
    from friendships.services import get_friend_ids
    from posts.models import Post
    from users.account_status import is_user_suspended
    from users.models import ProfileVisibility

    author = post.author
    if (
        post.moderation_status != Post.ModerationStatus.APPROVED
        and user.pk != author.pk
    ):
        return False
    if is_user_suspended(author) or not author.is_active:
        return False
    if user.pk == author.pk:
        return True
    if author.pk in get_blocked_user_ids(user) | get_muted_user_ids(user):
        return False
    if author.profile_visibility == ProfileVisibility.PRIVATE:
        return False

    is_friend = author.pk in get_friend_ids(user)
    if (
        author.profile_visibility == ProfileVisibility.FRIENDS
        and not is_friend
    ):
        return False
    if post.visibility == Post.Visibility.PUBLIC:
        return True
    return (
        post.visibility == Post.Visibility.FRIENDS
        and is_friend
    )


def filter_visible_posts(user, queryset=None):
    from friendships.services import get_friend_ids
    from posts.models import Post
    from users.models import ProfileVisibility

    friend_ids = set(get_friend_ids(user))
    excluded_author_ids = get_blocked_user_ids(user) | get_muted_user_ids(user)
    queryset = queryset if queryset is not None else Post.objects.all()

    return (
        queryset.filter(
            Q(
                author__is_active=True,
                author__is_suspended=False,
            )
            | Q(
                author__is_suspended=True,
                author__suspended_until__lte=timezone.now(),
                author__suspension_was_active=True,
            )
        )
        .filter(
            Q(author_id=user.pk)
            | Q(
                visibility=Post.Visibility.PUBLIC,
                author__profile_visibility=ProfileVisibility.PUBLIC,
            )
            | Q(
                visibility__in=(
                    Post.Visibility.PUBLIC,
                    Post.Visibility.FRIENDS,
                ),
                author_id__in=friend_ids,
                author__profile_visibility=ProfileVisibility.FRIENDS,
            )
            | Q(
                visibility=Post.Visibility.FRIENDS,
                author_id__in=friend_ids,
                author__profile_visibility=ProfileVisibility.PUBLIC,
            )
        )
        .filter(
            Q(author_id=user.pk)
            | Q(moderation_status=Post.ModerationStatus.APPROVED)
        )
        .exclude(author_id__in=excluded_author_ids)
    )


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
