from django.contrib.auth import get_user_model
from django.db.models import Q

from friendships.models import FriendRequest
from friendships.services import get_friend_ids
from users.models import ProfileVisibility
from users.privacy import (
    can_receive_friend_request,
    get_blocked_user_ids,
    get_muted_user_ids,
    filter_visible_posts,
)

User = get_user_model()


def visible_users_for(user):
    friend_ids = get_friend_ids(user)
    excluded_ids = get_blocked_user_ids(user) | get_muted_user_ids(user)

    return (
        User.objects.filter(is_active=True, is_suspended=False)
        .exclude(pk=user.pk)
        .exclude(pk__in=excluded_ids)
        .filter(
            Q(profile_visibility=ProfileVisibility.PUBLIC)
            | Q(
                profile_visibility=ProfileVisibility.FRIENDS,
                pk__in=friend_ids,
            )
        )
    )


def visible_posts_for(user):
    return filter_visible_posts(user)


def search_users(user, query):
    return visible_users_for(user).filter(
        Q(username__icontains=query)
        | Q(first_name__icontains=query)
        | Q(last_name__icontains=query)
        | Q(
            email__icontains=query,
            privacy_settings__discoverable_by_email=True,
        )
    ).order_by("username")


def search_posts(user, query):
    query = query.lstrip("#").strip()
    return visible_posts_for(user).filter(
        Q(content__icontains=query)
        | Q(author__username__icontains=query)
    ).select_related("author").order_by("-created_at")


def get_user_suggestions(user, limit=20):
    friend_ids = set(get_friend_ids(user))
    if not friend_ids:
        return User.objects.none()

    accepted_requests = FriendRequest.objects.filter(
        status=FriendRequest.Status.ACCEPTED,
    ).filter(
        Q(sender_id__in=friend_ids) | Q(receiver_id__in=friend_ids)
    ).values_list("sender_id", "receiver_id")

    mutual_friend_counts = {}
    for sender_id, receiver_id in accepted_requests:
        candidate_id = receiver_id if sender_id in friend_ids else sender_id
        if candidate_id != user.pk and candidate_id not in friend_ids:
            mutual_friend_counts[candidate_id] = (
                mutual_friend_counts.get(candidate_id, 0) + 1
            )

    if not mutual_friend_counts:
        return User.objects.none()

    pending_ids = set(
        FriendRequest.objects.filter(
            Q(sender=user) | Q(receiver=user),
            status=FriendRequest.Status.PENDING,
        ).values_list("sender_id", "receiver_id")
    )
    excluded_ids = get_blocked_user_ids(user) | friend_ids | {user.pk}
    for sender_id, receiver_id in pending_ids:
        excluded_ids.add(receiver_id if sender_id == user.pk else sender_id)

    ordered_ids = sorted(
        mutual_friend_counts,
        key=lambda candidate_id: (-mutual_friend_counts[candidate_id], candidate_id),
    )
    candidates = visible_users_for(user).filter(
        pk__in=ordered_ids,
    ).exclude(pk__in=excluded_ids).in_bulk()

    suggestions = []
    for candidate_id in ordered_ids:
        candidate = candidates.get(candidate_id)
        if candidate and can_receive_friend_request(user, candidate):
            suggestions.append(candidate)
            if len(suggestions) >= max(1, min(limit, 50)):
                break

    return suggestions
