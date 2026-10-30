import logging

from django.contrib.auth import authenticate, get_user_model
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    BlockedUser,
    EmailVerification,
    TwoFactorChallenge,
    UserPrivacySettings,
    UserSecuritySettings,
)
from .privacy import are_friends, get_blocked_user_ids, is_blocked_between
from .serializers import (
    BlockedUserSerializer,
    EmailVerificationSerializer,
    ProfileUpdateSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    UserPrivacySettingsSerializer,
    UserSerializer,
)
from .two_factor import send_two_factor_code, verify_two_factor_code
from .verification import (
    OTP_RESEND_COOLDOWN_SECONDS,
    send_verification_code,
)

User = get_user_model()
logger = logging.getLogger(__name__)


def profile_access_error(request, user):
    if is_blocked_between(request.user, user):
        return Response(
            {"detail": "This profile is unavailable."},
            status=status.HTTP_403_FORBIDDEN,
        )
    if user.pk == request.user.pk:
        return None
    if user.profile_visibility == "private":
        return Response(
            {"detail": "This profile is private."},
            status=status.HTTP_403_FORBIDDEN,
        )
    if user.profile_visibility == "friends" and not are_friends(
        request.user,
        user,
    ):
        return Response(
            {"detail": "This profile is only visible to friends."},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            with transaction.atomic():
                serializer.save()
        except IntegrityError:
            return Response(
                {"error": "Username or email is already registered."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "message": "Registration successful. You can now sign in."
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyEmailView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = EmailVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"message": "Email verified successfully."},
            status=status.HTTP_200_OK,
        )


class ResendVerificationCodeView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get("email") or ""
        email = email.strip()
        user = User.objects.filter(
            email__iexact=email,
            is_email_verified=False,
        ).first()
        if user:
            verification, _ = EmailVerification.objects.get_or_create(
                user=user
            )
            if (
                verification.last_sent_at
                and (
                    timezone.now() - verification.last_sent_at
                ).total_seconds() < OTP_RESEND_COOLDOWN_SECONDS
            ):
                return Response(
                    {"detail": "Please wait before requesting another code."},
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )
            send_verification_code(user, verification)
        return Response(
            {"message": "If the account can be verified, a code has been sent."},
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

        if UserSecuritySettings.objects.filter(
            user=user,
            two_factor_enabled=True,
        ).exists():
            send_two_factor_code(user, TwoFactorChallenge.Purpose.LOGIN)
            return Response(
                {
                    "two_factor_required": True,
                    "username": user.username,
                },
                status=status.HTTP_200_OK,
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
        username = request.data.get("username", "").strip()
        code = request.data.get("code", "")
        user = User.objects.filter(username__iexact=username).first()
        if not user or not user.is_active:
            return Response(
                {"detail": "Invalid verification code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            challenge = user.two_factor_challenge
        except TwoFactorChallenge.DoesNotExist:
            return Response(
                {"detail": "Invalid or expired verification code."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if challenge.purpose != TwoFactorChallenge.Purpose.LOGIN:
            return Response(
                {"detail": "Invalid verification code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        valid, error = verify_two_factor_code(challenge, code)
        if not valid:
            return Response(
                {"detail": error},
                status=status.HTTP_400_BAD_REQUEST,
            )

        challenge.delete()
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "refresh": str(refresh),
                "access": str(refresh.access_token),
            },
            status=status.HTTP_200_OK,
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

    def patch(self, request):
        return self.update_profile(request, partial=True)

    def put(self, request):
        return self.update_profile(request, partial=False)

    def update_profile(self, request, partial):
        serializer = ProfileUpdateSerializer(
            request.user,
            data=request.data,
            partial=partial,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            UserSerializer(
                request.user,
                context={"request": request},
            ).data,
            status=status.HTTP_200_OK,
        )


class TwoFactorSettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        action = request.data.get("action")
        if not request.user.check_password(request.data.get("password", "")):
            return Response(
                {"detail": "The password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if action == "start_enable":
            settings_obj, _ = UserSecuritySettings.objects.get_or_create(
                user=request.user
            )
            if settings_obj.two_factor_enabled:
                return Response(
                    {"detail": "Two-factor authentication is already enabled."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            send_two_factor_code(
                request.user,
                TwoFactorChallenge.Purpose.ENABLE,
            )
            return Response(
                {"message": "A confirmation code has been sent to your email."},
                status=status.HTTP_200_OK,
            )

        if action == "confirm_enable":
            try:
                challenge = request.user.two_factor_challenge
            except TwoFactorChallenge.DoesNotExist:
                return Response(
                    {"detail": "Request a new confirmation code."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if challenge.purpose != TwoFactorChallenge.Purpose.ENABLE:
                return Response(
                    {"detail": "Request a new confirmation code."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            valid, error = verify_two_factor_code(
                challenge,
                request.data.get("code", ""),
            )
            if not valid:
                return Response(
                    {"detail": error},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            settings_obj, _ = UserSecuritySettings.objects.get_or_create(
                user=request.user
            )
            settings_obj.two_factor_enabled = True
            settings_obj.save(update_fields=["two_factor_enabled"])
            challenge.delete()
            return Response(
                {"two_factor_enabled": True},
                status=status.HTTP_200_OK,
            )

        return Response(
            {"detail": "Invalid two-factor action."},
            status=status.HTTP_400_BAD_REQUEST,
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
        serializer = UserPrivacySettingsSerializer(settings_obj)
        return Response(
            {"privacy": serializer.data},
            status=status.HTTP_200_OK,
        )

    def patch(self, request):
        settings_obj, _ = UserPrivacySettings.objects.get_or_create(
            user=request.user
        )
        serializer = UserPrivacySettingsSerializer(
            settings_obj,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request):
        settings_obj, _ = UserPrivacySettings.objects.get_or_create(
            user=request.user
        )
        serializer = UserPrivacySettingsSerializer(
            settings_obj,
            data=request.data,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)


class BlockedUsersView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, user_id=None):
        if user_id is not None:
            return Response(
                {"detail": "Method not allowed."},
                status=status.HTTP_405_METHOD_NOT_ALLOWED,
            )
        blocked_users = BlockedUser.objects.filter(
            blocker=request.user
        ).select_related("blocked")
        return Response(
            BlockedUserSerializer(blocked_users, many=True).data,
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        user_id = request.data.get("user_id")
        username = request.data.get("username")
        if not user_id and not username:
            return Response(
                {"detail": "A user ID or username is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            blocked_user = (
                User.objects.get(pk=user_id)
                if user_id
                else User.objects.get(username__iexact=username)
            )
        except (User.DoesNotExist, ValueError, TypeError):
            return Response(
                {"detail": "User not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if blocked_user == request.user:
            return Response(
                {"detail": "You cannot block yourself."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        blocked, created = BlockedUser.objects.get_or_create(
            blocker=request.user,
            blocked=blocked_user,
        )
        return Response(
            BlockedUserSerializer(blocked).data,
            status=(
                status.HTTP_201_CREATED
                if created
                else status.HTTP_200_OK
            ),
        )

    def delete(self, request, user_id=None):
        if user_id is None:
            return Response(
                {"detail": "A user ID is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        deleted, _ = BlockedUser.objects.filter(
            blocker=request.user,
            blocked_id=user_id,
        ).delete()
        if not deleted:
            return Response(
                {"detail": "Blocked user not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserSearchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        query = request.query_params.get(
            "q",
            request.query_params.get("search", ""),
        ).strip()
        if not query:
            return Response({"results": []}, status=status.HTTP_200_OK)

        users = User.objects.exclude(pk=request.user.pk).filter(
            Q(username__icontains=query)
            | Q(first_name__icontains=query)
            | Q(last_name__icontains=query)
            | Q(
                email__icontains=query,
                privacy_settings__discoverable_by_email=True,
            )
        )
        blocked_ids = get_blocked_user_ids(request.user)
        if blocked_ids:
            users = users.exclude(pk__in=blocked_ids)
        users = users.distinct().order_by("username")
        return Response(
            {
                "results": UserSerializer(
                    users,
                    many=True,
                    context={"request": request},
                ).data
            },
            status=status.HTTP_200_OK,
        )


class UserDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, id):
        user = get_object_or_404(User, pk=id)
        access_error = profile_access_error(request, user)
        if access_error:
            return access_error
        return Response(
            UserSerializer(user, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


class UserByUsernameView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, username):
        user = get_object_or_404(User, username__iexact=username)
        access_error = profile_access_error(request, user)
        if access_error:
            return access_error
        return Response(
            UserSerializer(user, context={"request": request}).data,
            status=status.HTTP_200_OK,
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
                "account": {
                    "username": user.username,
                    "email": user.email,
                    "date_joined": user.date_joined,
                },
            },
            status=status.HTTP_200_OK,
        )


class AccountDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete_account(self, request, response_status):
        if (
            request.data.get("confirmation") != "DELETE"
            or not request.user.check_password(
                request.data.get("password", "")
            )
        ):
            return Response(
                {"detail": "Password and DELETE confirmation are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        request.user.delete()
        return Response(
            {"message": "Account deleted."}
            if response_status == status.HTTP_200_OK
            else None,
            status=response_status,
        )

    def post(self, request):
        return self.delete_account(request, status.HTTP_200_OK)

    def delete(self, request):
        return self.delete_account(request, status.HTTP_204_NO_CONTENT)