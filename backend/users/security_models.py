from django.conf import settings
from django.db import models


class SecurityEvent(models.Model):
    class EventType(models.TextChoices):
        LOGIN = "login", "Login"
        LOGIN_FAILED = "login_failed", "Login failed"
        PASSWORD_CHANGED = "password_changed", "Password changed"
        ACCOUNT_DELETED = "account_deleted", "Account deleted"
        TOKEN_REFRESH = "token_refresh", "Token refresh"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="security_events",
    )
    event_type = models.CharField(max_length=40, choices=EventType.choices)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["user", "-created_at"],
                name="users_se_user_date_idx",
            ),
            models.Index(
                fields=["event_type", "-created_at"],
                name="users_se_type_date_idx",
            ),
        ]

    def __str__(self):
        return f"{self.event_type} security event"
