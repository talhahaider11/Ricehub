from rest_framework.permissions import BasePermission

from .models import ProfileVisibility, User
from friendships.services import get_friend_ids
from .privacy import is_blocked_between


class CanViewProfile(
    BasePermission
):

    def has_object_permission(
        self,
        request,
        view,
        obj,
    ):

        if obj == request.user:
            return True

        if is_blocked_between(request.user, obj):
            return False

        if (
            obj.profile_visibility
            == ProfileVisibility.PUBLIC
        ):
            return True

        if (
            obj.profile_visibility
            == ProfileVisibility.PRIVATE
        ):
            return False

        if (
            obj.profile_visibility
            == ProfileVisibility.FRIENDS
        ):
            return (
                obj.id
                in get_friend_ids(request.user)
            )

        return False