from django.contrib.auth import get_user_model

from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from config.throttling import RefreshRateThrottle
from .models import SecurityEvent
from .security_events import record_security_event

User = get_user_model()


class SecurityTokenRefreshView(TokenRefreshView):
    throttle_classes = [RefreshRateThrottle]

    def post(self, request, *args, **kwargs):
        user_id = None
        refresh_token = request.data.get("refresh")
        if isinstance(refresh_token, str):
            try:
                user_id = RefreshToken(refresh_token)["user_id"]
            except (TokenError, KeyError):
                pass

        response = super().post(request, *args, **kwargs)
        if response.status_code < 400 and user_id is not None:
            user = User.objects.filter(pk=user_id).first()
            if user:
                record_security_event(
                    user,
                    SecurityEvent.EventType.TOKEN_REFRESH,
                    request,
                )
        return response
