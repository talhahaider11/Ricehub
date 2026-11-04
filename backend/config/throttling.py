from rest_framework.throttling import (
    SimpleRateThrottle,
    UserRateThrottle,
)


class LoginRateThrottle(SimpleRateThrottle):
    scope = "login"

    def get_cache_key(self, request, view):
        return self.cache_format % {
            "scope": self.scope,
            "ident": self.get_ident(request),
        }


class RegisterRateThrottle(SimpleRateThrottle):
    scope = "register"

    def get_cache_key(self, request, view):
        return self.cache_format % {
            "scope": self.scope,
            "ident": self.get_ident(request),
        }


class PasswordRateThrottle(SimpleRateThrottle):
    scope = "password"

    def get_cache_key(self, request, view):
        return self.cache_format % {
            "scope": self.scope,
            "ident": self.get_ident(request),
        }


class RefreshRateThrottle(SimpleRateThrottle):
    scope = "refresh"

    def get_cache_key(self, request, view):
        return self.cache_format % {
            "scope": self.scope,
            "ident": self.get_ident(request),
        }


class PostCreateRateThrottle(UserRateThrottle):
    scope = "post_create"


class MediaUploadRateThrottle(UserRateThrottle):
    scope = "media_upload"


class BurstRateThrottle(UserRateThrottle):
    scope = "burst"


class SustainedRateThrottle(UserRateThrottle):
    scope = "sustained"


class ModerationRateThrottle(UserRateThrottle):
    scope = "moderation"


class ReportRateThrottle(UserRateThrottle):
    scope = "report"


class MessageRateThrottle(UserRateThrottle):
    scope = "message"


class AdminRateThrottle(UserRateThrottle):
    scope = "admin"


class ModerationThrottleMixin:
    def get_throttles(self):
        throttles = super().get_throttles()
        if self.request.method in {"POST", "PUT", "PATCH", "DELETE"}:
            return [ModerationRateThrottle(), *throttles]
        return throttles


class AdminThrottleMixin:
    def get_throttles(self):
        return [AdminRateThrottle(), *super().get_throttles()]
