from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from config.permissions import IsActiveAndNotSuspended as IsAuthenticated
from config.throttling import PasswordRateThrottle
from .models import SecurityEvent
from .security_events import record_security_event
from .serializers import (
    PasswordChangeSerializer,
    PasswordResetConfirmSerializer,
)


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [PasswordRateThrottle]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        record_security_event(
            user,
            SecurityEvent.EventType.PASSWORD_CHANGED,
            request,
        )
        return Response(
            {"detail": "Password reset successfully."},
            status=status.HTTP_200_OK,
        )


class PasswordChangeView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [PasswordRateThrottle]

    def post(self, request):
        serializer = PasswordChangeSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        record_security_event(
            user,
            SecurityEvent.EventType.PASSWORD_CHANGED,
            request,
        )
        return Response(
            {"detail": "Password changed successfully."},
            status=status.HTTP_200_OK,
        )