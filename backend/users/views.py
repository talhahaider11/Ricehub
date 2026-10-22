from django.contrib.auth import get_user_model
from smtplib import SMTPException
from django.db import transaction
from django.utils import timezone
import logging
import socket
from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import (
    BlockedUserSerializer,
    EmailVerificationSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    UserPrivacySettingsSerializer,
    UserSecuritySettingsSerializer,
    UserSerializer,
)
from .models import (
    BlockedUser,
    EmailVerification,
    ProfileVisibility,
    TwoFactorChallenge,
    UserPrivacySettings,
    UserSecuritySettings,
)
from .verification import send_verification_code
from .privacy import get_blocked_user_ids, is_blocked_between
from .two_factor import (
    mask_email,
    send_two_factor_code,
    verify_two_factor_code,
)
from rest_framework.parsers import (FormParser,MultiPartParser,)
from .permissions import CanViewProfile
from django.db.models import Q
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.views import TokenObtainPairView

from .throttles import LoginRateThrottle
from friendships.services import get_friend_ids

logger = logging.getLogger(__name__)
User = get_user_model()


def revoke_user_refresh_tokens(user):
    from rest_framework_simplejwt.token_blacklist.models import (
        BlacklistedToken,
        OutstandingToken,
    )

    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)


class VerifiedTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        if not self.user.is_email_verified:
            raise AuthenticationFailed(
                {
                    "detail": "Verify your email before signing in.",
                    "code": "email_not_verified",
                    "email": self.user.email,
                }
            )
        security_settings, _ = UserSecuritySettings.objects.get_or_create(
            user=self.user
        )
        if security_settings.two_factor_enabled:
            RefreshToken(data["refresh"]).blacklist()
            try:
                send_two_factor_code(
                    self.user,
                    TwoFactorChallenge.Purpose.LOGIN,
                )
            except (SMTPException, OSError, socket.timeout) as error:
                logger.exception(
                    "Unable to send two-factor code for user %s",
                    self.user.pk,
                )
                raise AuthenticationFailed(
                    {
                        "detail": "The sign-in code could not be sent. Check email settings and try again.",
                        "code": "two_factor_email_unavailable",
                    }
                ) from error
            return {
                "two_factor_required": True,
                "email": mask_email(self.user.email),
                "username": self.user.username,
            }
        return data


class LoginView(TokenObtainPairView):
    throttle_classes = [
        LoginRateThrottle
    ]
    serializer_class = VerifiedTokenObtainPairSerializer


class VerifyTwoFactorLoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        username = request.data.get("username", "")
        code = request.data.get("code", "")
        if not isinstance(username, str) or not isinstance(code, str) or not code.isdigit() or len(code) != 6:
            return Response(
                {"detail": "Enter the username and 6-digit verification code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.filter(username__iexact=username).first()
        if not user or not user.is_active or not user.is_email_verified:
            return Response(
                {"detail": "The verification code is invalid or expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            challenge = user.two_factor_challenge
        except TwoFactorChallenge.DoesNotExist:
            return Response(
                {"detail": "The verification code is invalid or expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if challenge.purpose != TwoFactorChallenge.Purpose.LOGIN:
            return Response(
                {"detail": "The verification code is invalid or expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        valid, detail = verify_two_factor_code(challenge, code)
        if not valid:
            return Response({"detail": detail}, status=status.HTTP_400_BAD_REQUEST)

        challenge.delete()
        refresh = RefreshToken.for_user(user)
        return Response(
            {"refresh": str(refresh), "access": str(refresh.access_token)}
        )


class TwoFactorSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        settings, _ = UserSecuritySettings.objects.get_or_create(
            user=request.user
        )
        return Response(UserSecuritySettingsSerializer(settings).data)

    def post(self, request):
        action = request.data.get("action")
        password = request.data.get("password", "")
        if not isinstance(password, str) or not request.user.check_password(password):
            return Response(
                {"detail": "Enter your current password to change this setting."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        settings, _ = UserSecuritySettings.objects.get_or_create(
            user=request.user
        )
        if action == "start_enable":
            if not request.user.is_email_verified:
                return Response(
                    {"detail": "Verify your email before enabling two-step verification."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                send_two_factor_code(
                    request.user,
                    TwoFactorChallenge.Purpose.ENABLE,
                )
            except (SMTPException, OSError, socket.timeout) as error:
                logger.exception(
                    "Unable to send two-factor setup code for user %s",
                    request.user.pk,
                )
                return Response(
                    {"detail": "The verification code could not be sent. Check your email settings and try again."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            return Response({"detail": f"A confirmation code was sent to {mask_email(request.user.email)}."})

        if action == "confirm_enable":
            code = request.data.get("code", "")
            if not isinstance(code, str) or not code.isdigit() or len(code) != 6:
                return Response(
                    {"detail": "Enter the 6-digit verification code."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                challenge = request.user.two_factor_challenge
            except TwoFactorChallenge.DoesNotExist:
                return Response(
                    {"detail": "Request a new verification code first."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if challenge.purpose != TwoFactorChallenge.Purpose.ENABLE:
                return Response(
                    {"detail": "Request a new verification code first."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            valid, detail = verify_two_factor_code(challenge, code)
            if not valid:
                return Response({"detail": detail}, status=status.HTTP_400_BAD_REQUEST)
            settings.two_factor_enabled = True
            settings.save(update_fields=["two_factor_enabled"])
            challenge.delete()
            revoke_user_refresh_tokens(request.user)
            return Response(UserSecuritySettingsSerializer(settings).data)

        if action == "disable":
            settings.two_factor_enabled = False
            settings.save(update_fields=["two_factor_enabled"])
            TwoFactorChallenge.objects.filter(user=request.user).delete()
            revoke_user_refresh_tokens(request.user)
            return Response(UserSecuritySettingsSerializer(settings).data)

        return Response(
            {"detail": "Choose start_enable, confirm_enable or disable."},
            status=status.HTTP_400_BAD_REQUEST,
        )


class SecuritySessionsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        revoke_user_refresh_tokens(request.user)
        return Response({"detail": "All refresh-token sessions have been signed out."})


class AccountExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from friendships.models import FriendRequest
        from messaging.models import Message
        from notifications.models import Notification
        from posts.models import Post

        user = request.user
        friendships = FriendRequest.objects.filter(
            Q(sender=user) | Q(receiver=user)
        ).values("sender__username", "receiver__username", "status", "created_at")
        messages = Message.objects.filter(sender=user).values(
            "conversation_id", "content", "created_at"
        )
        notifications = Notification.objects.filter(recipient=user).values(
            "notification_type", "message", "is_read", "created_at"
        )
        posts = Post.objects.filter(author=user).values(
            "content", "image", "visibility", "created_at"
        )
        return Response({
            "account": {
                "username": user.username,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "date_joined": user.date_joined,
                "is_email_verified": user.is_email_verified,
            },
            "posts": list(posts),
            "friendships": list(friendships),
            "sent_messages": list(messages),
            "notifications": list(notifications),
        })


class AccountDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        password = request.data.get("password", "")
        confirmation = request.data.get("confirmation", "")
        if not isinstance(password, str) or not request.user.check_password(password):
            return Response(
                {"detail": "Your current password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if confirmation != "DELETE":
            return Response(
                {"detail": "Type DELETE to confirm permanent account removal."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        request.user.delete()
        return Response(
            {"detail": "Your account and associated account data have been deleted."},
            status=status.HTTP_200_OK,
        )


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()

    serializer_class = RegisterSerializer

    permission_classes = [
        AllowAny
    ]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        with transaction.atomic():
            user = serializer.save()
            verification, _ = EmailVerification.objects.get_or_create(
                user=user
            )

        try:
            send_verification_code(user, verification)
        except (SMTPException, OSError, socket.timeout):
            logger.exception(
                "Unable to send verification email for user %s",
                user.pk,
            )
            return Response(
                {
                    "detail": (
                        "Your account was created, but the verification email "
                        "could not be sent. Configure email delivery and "
                        "request a new code."
                    ),
                    "email": user.email,
                    "verification_required": True,
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            {
                "message": "Account created. Check your email for the verification code.",
                "email": user.email,
                "verification_required": True,
            },
            status=201
        )


class VerifyEmailView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = EmailVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Email verified. You can now sign in."})


class ResendVerificationCodeView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email", "")
        if not isinstance(email, str):
            return Response(
                {"email": ["Enter a valid email address."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from django.core.validators import validate_email
        from django.core.exceptions import ValidationError

        try:
            validate_email(email)
        except ValidationError:
            return Response(
                {"email": ["Enter a valid email address."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.filter(
            email__iexact=email,
            is_email_verified=False,
        ).first()
        if not user:
            return Response(
                {"detail": "If the account needs verification, a new code will be sent."}
            )

        verification, _ = EmailVerification.objects.get_or_create(user=user)
        if verification.last_sent_at:
            retry_after = 60 - int(
                (timezone.now() - verification.last_sent_at).total_seconds()
            )
            if retry_after > 0:
                return Response(
                    {"detail": f"Please wait {retry_after} seconds before requesting another code."},
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )

        try:
            send_verification_code(user, verification)
        except (SMTPException, OSError, socket.timeout):
            logger.exception(
                "Unable to resend verification email for user %s",
                user.pk,
            )
            return Response(
                {"detail": "The verification email could not be sent. Check the email server settings and try again."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response(
            {"detail": "If the account needs verification, a new code will be sent."}
        )


class CurrentUserView(APIView):
    permission_classes = [
        IsAuthenticated
    ]

    def get(self, request):
        serializer = UserSerializer(
            request.user,
            context={
                "request": request
            }
        )

        return Response(serializer.data)


MeView = CurrentUserView


class UserPrivacySettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        settings, _ = UserPrivacySettings.objects.get_or_create(
            user=request.user
        )
        return Response(UserPrivacySettingsSerializer(settings).data)

    def patch(self, request):
        settings, _ = UserPrivacySettings.objects.get_or_create(
            user=request.user
        )
        serializer = UserPrivacySettingsSerializer(
            settings,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class BlockedUsersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        blocked_users = BlockedUser.objects.filter(
            blocker=request.user
        ).select_related("blocked").order_by("-created_at")
        return Response(BlockedUserSerializer(blocked_users, many=True).data)

    def post(self, request):
        user_id = request.data.get("user_id")
        username = request.data.get("username")
        try:
            target_query = User.objects.filter(is_active=True)
            if user_id:
                target = target_query.get(pk=user_id)
            elif isinstance(username, str) and username.strip():
                target = target_query.get(username__iexact=username.strip())
            else:
                raise User.DoesNotExist
        except (User.DoesNotExist, TypeError, ValueError):
            return Response(
                {"detail": "User not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if target == request.user:
            return Response(
                {"detail": "You cannot block your own account."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        blocked, created = BlockedUser.objects.get_or_create(
            blocker=request.user,
            blocked=target,
        )
        from friendships.models import FriendRequest

        FriendRequest.objects.filter(
            Q(sender=request.user, receiver=target)
            | Q(sender=target, receiver=request.user),
        ).exclude(
            status=FriendRequest.Status.REJECTED
        ).update(status=FriendRequest.Status.REJECTED)
        return Response(
            BlockedUserSerializer(blocked).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request, user_id):
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


class UserDetailView(
    generics.RetrieveAPIView
):

    queryset = User.objects.all()

    serializer_class = UserSerializer

    permission_classes = [
        IsAuthenticated,
        CanViewProfile,
    ]

    lookup_field = "id"

    def get_serializer_context(self):
        return {
            "request": self.request
        }

class CurrentUserUpdateView(
    generics.UpdateAPIView
):

    serializer_class = UserSerializer

    permission_classes = [
        IsAuthenticated
    ]

    parser_classes = [
        MultiPartParser,
        FormParser,
    ]

    def get_object(self):
        return self.request.user

    def get_serializer_context(self):
        return {
            "request": self.request
        }


ProfileUpdateView = CurrentUserUpdateView


class UserSearchView(
    generics.ListAPIView
):

    serializer_class = UserSerializer

    permission_classes = [
        IsAuthenticated
    ]

    def get_queryset(self):

        query = (
            self.request
            .query_params
            .get("q", "")
            .strip()
        )

        if not query:
            return User.objects.none()

        blocked_ids = get_blocked_user_ids(self.request.user)
        searchable_users = (
            Q(username__icontains=query)
            | Q(first_name__icontains=query)
            | Q(last_name__icontains=query)
        )
        if "@" in query:
            searchable_users |= Q(
                email__iexact=query,
                privacy_settings__discoverable_by_email=True,
            )
        visible_profiles = Q(profile_visibility=ProfileVisibility.PUBLIC) | Q(
            profile_visibility=ProfileVisibility.FRIENDS,
            id__in=get_friend_ids(self.request.user),
        )

        return (
            User.objects
            .filter(searchable_users, visible_profiles, is_active=True)
            .exclude(
                id__in=blocked_ids | {self.request.user.id}
            )
            .order_by(
                "username"
            )
        )

    def get_serializer_context(self):

        return {
            "request": self.request
        }

class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        serializer.save()

        return Response(
            {
                "detail": (
                    "If an account exists with that email, "
                    "a password reset link has been sent."
                )
            },
            status=status.HTTP_200_OK,
        )

class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        serializer.save()

        return Response(
            {
                "detail": "Password has been reset successfully."
            }
        )

class UserByUsernameView(
    generics.RetrieveAPIView
):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [
        IsAuthenticated,
        CanViewProfile,
    ]
    lookup_field = "username"
