from django.utils import timezone


def is_user_suspended(user):
    if not getattr(user, "is_suspended", False):
        return False

    suspended_until = getattr(user, "suspended_until", None)
    if suspended_until and suspended_until <= timezone.now():
        update_fields = [
            "is_suspended",
            "suspended_until",
            "suspension_reason",
            "suspended_at",
            "suspended_by",
            "suspension_was_active",
        ]
        user.is_suspended = False
        user.suspended_until = None
        user.suspension_reason = ""
        user.suspended_at = None
        user.suspended_by = None
        if user.suspension_was_active is not None:
            user.is_active = user.suspension_was_active
            update_fields.append("is_active")
        user.suspension_was_active = None
        user.save(update_fields=update_fields)
        return False

    return True
