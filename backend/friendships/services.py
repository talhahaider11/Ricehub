from django.db.models import Q

from .models import FriendRequest


def get_friend_ids(user):

    friendships = (
        FriendRequest.objects
        .filter(
            status=FriendRequest.Status.ACCEPTED
        )
        .filter(
            Q(sender=user)
            | Q(receiver=user)
        )
    )

    friend_ids = []

    for friendship in friendships:

        if friendship.sender_id == user.id:
            friend_ids.append(
                friendship.receiver_id
            )
        else:
            friend_ids.append(
                friendship.sender_id
            )

    return friend_ids