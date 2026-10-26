import logging
from datetime import timedelta

from django.contrib.auth import authenticate, get_user_model
from django.db import IntegrityError, transaction
from django.utils import timezone

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import UserPrivacySettings
from .serializers import (
    PasswordResetRequestSerializer,
    RegisterSerializer,
)

User = get_user_model()
logger = logging.getLogger(__name__)


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            with transaction.atomic():
                # User account create karke auto-activate kar dein
                user = serializer.save(
                    is_active=True,
                    is_email_verified=True
                )
        except IntegrityError:
            return Response(
                {"error": "Username or email is already registered."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "message": (
                    "Registration successful! You can now log in directly."
                )
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyEmailView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        # Verification temporary bypass - frontend error na throw kare
        return Response(
            {
                "message": (
                    "Email verification is currently disabled. Account is active."
                )
            },
            status=status.HTTP_200_OK,
        )


class ResendVerificationCodeView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        return Response(
            {"message": "Email verification is currently disabled."},
            status=status.HTTP_200_OK,
        )


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")

        if not username or not password:
            return Response(
                {"error": "Username and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = authenticate(username=username, password=password)

        if not user:
            return Response(
                {"error": "Invalid credentials."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not user.is_active:
            return Response(
                {"error": "Account is disabled."},
                status=status.HTTP_403_FORBIDDEN,
            )

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "refresh": str(refresh),
                "access": str(refresh.access_token),
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                },
            },
            status=status.HTTP_200_OK,
        )


class VerifyTwoFactorLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        return Response(
            {"error": "Two-factor verification is not implemented."},
            status=status.HTTP_501_NOT_IMPLEMENTED,
        )


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
            },
            status=status.HTTP_200_OK,
        )


class ProfileUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def put(self, request):
        return Response(
            {"message": "Profile update endpoint needs implementation."},
            status=status.HTTP_501_NOT_IMPLEMENTED,
        )


class TwoFactorSettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        return Response(
            {"message": "Two-factor settings need implementation."},
            status=status.HTTP_501_NOT_IMPLEMENTED,
        )


class SecuritySessionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        return Response(
            {"message": "Session revocation needs implementation."},
            status=status.HTTP_501_NOT_IMPLEMENTED,
        )


class UserPrivacySettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        settings_obj, _ = UserPrivacySettings.objects.get_or_create(
            user=request.user
        )
        from .serializers import UserPrivacySettingsSerializer

        serializer = UserPrivacySettingsSerializer(settings_obj)
        return Response(
            {"privacy": serializer.data},
            status=status.HTTP_200_OK,
        )


class BlockedUsersView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, user_id=None):
        return Response(
            {"error": "Blocked-user listing needs implementation."},
            status=status.HTTP_501_NOT_IMPLEMENTED,
        )


class UserSearchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(
            {"error": "User search needs implementation."},
            status=status.HTTP_501_NOT_IMPLEMENTED,
        )


class UserDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, id):
        return Response(
            {"error": "User detail endpoint needs implementation."},
            status=status.HTTP_501_NOT_IMPLEMENTED,
        )


class UserByUsernameView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, username):
        return Response(
            {"error": "User lookup needs implementation."},
            status=status.HTTP_501_NOT_IMPLEMENTED,
        )


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            serializer.save()
        except Exception:
            logger.exception("Password reset email sending failed")

        return Response(
            {
                "message": (
                    "If an account exists for this email, "
                    "password reset instructions will be sent."
                )
            },
            status=status.HTTP_200_OK,
        )


class AccountExportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response(
            {
                "username": user.username,
                "email": user.email,
                "date_joined": user.date_joined,
            },
            status=status.HTTP_200_OK,
        )


class AccountDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request):
        request.user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)