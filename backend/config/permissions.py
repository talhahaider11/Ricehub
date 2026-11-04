from rest_framework.permissions import IsAdminUser, IsAuthenticated

from users.account_status import is_user_suspended


class IsActiveAndNotSuspended(IsAuthenticated):
    message = "Your account is currently unavailable."

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False

        user = request.user
        suspended = is_user_suspended(user)
        return user.is_active and not suspended


class IsActiveAdminUser(IsAdminUser):
    message = "Your account is currently unavailable."

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False

        user = request.user
        suspended = is_user_suspended(user)
        return user.is_active and not suspended
