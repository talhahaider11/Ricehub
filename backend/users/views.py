import logging
import re
import secrets
import smtplib
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password, make_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import permissions, status
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)
from rest_framework_simplejwt.tokens import RefreshToken

from config.permissions import IsActiveAndNotSuspended
from config.throttling import (
    LoginRateThrottle,
    ModerationThrottleMixin,
    PasswordRateThrottle,
    RegisterRateThrottle,
    ReportRateThrottle,
)
from config.pagination import StandardPagination

from .models import (
    AccountReport,
    BlockedUser,
    EmailVerification,
    PhoneVerification,
    MutedUser,
    SecurityEvent,
    SupportRequest,
    TwoFactorChallenge,
    UserPrivacySettings,
    UserSecuritySettings,
)
from .phone_verification import (
    SMSConfigurationError,
    SMSDeliveryError,
    send_sms,
)
from .account_status import is_user_suspended
from .privacy import are_friends, is_blocked_between
from .security_events import record_security_event
from search.services import search_users
from .serializers import (
    BlockedUserSerializer,
    EmailVerificationSerializer,
    ProfileUpdateSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    UserPrivacySettingsSerializer,
    UserSerializer,
    suggest_usernames,
)
from .two_factor import (
    mask_email,
    send_two_factor_code,
    verify_two_factor_code,
)
from .verification import (
    OTP_RESEND_COOLDOWN_SECONDS,
    send_verification_code,
)

User = get_user_model()
logger = logging.getLogger(__name__)


def profile_access_error(request, user):
    suspended = is_user_suspended(user)
    if not user.is_active or suspended:
        return Response(
            {"detail": "This profile is unavailable."},
            status=status.HTTP_404_NOT_FOUND,
        )
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
    throttle_classes = [RegisterRateThrottle]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            with transaction.atomic():
                user = serializer.save()
        except IntegrityError:
            return Response(
                {"error": "Username or email is already registered."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "message": "Account created successfully.",
                "email": user.email,
            },
            status=status.HTTP_201_CREATED,
        )


class UsernameAvailabilityView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        username = request.query_params.get("username", "").strip()
        if not username:
            return Response(
                {"username": ["Enter a username to check availability."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            User._meta.get_field("username").clean(username, None)
        except DjangoValidationError as error:
            return Response(
                {"username": error.messages},
                status=status.HTTP_400_BAD_REQUEST,
            )

        available = not User.objects.filter(
            username__iexact=username
        ).exists()
        return Response(
            {
                "username": username,
                "available": available,
                "suggestions": (
                    [] if available else suggest_usernames(username)
                ),
            },
            status=status.HTTP_200_OK,
        )


class VerifyEmailView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [RegisterRateThrottle]

    def post(self, request):
        serializer = EmailVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {
                "message": "Email verified successfully.",
                "detail": "Email verified successfully.",
            },
            status=status.HTTP_200_OK,
        )


class PhoneVerificationView(APIView):
    permission_classes = [IsActiveAndNotSuspended]
    throttle_classes = [RegisterRateThrottle]
    phone_pattern = re.compile(r"^\+[1-9]\d{7,14}$")

    def post(self, request):
        phone_number = request.data.get("phone_number")
        if not isinstance(phone_number, str):
            return Response(
                {"phone_number": "Enter a phone number in international format."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        phone_number = phone_number.strip()
        if not self.phone_pattern.fullmatch(phone_number):
            return Response(
                {"phone_number": "Use E.164 format, for example +923001234567."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if request.data.get("action") == "verify":
            return self.verify_code(request, phone_number)
        if request.data.get("action") != "send":
            return Response(
                {"action": "Choose send or verify."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            verification = request.user.phone_verification
        except PhoneVerification.DoesNotExist:
            verification = None
        if (
            request.user.is_phone_verified
            and request.user.phone_number == phone_number
        ):
            return Response({"detail": "Phone number is already verified."})
        if (
            verification
            and verification.phone_number == phone_number
            and (timezone.now() - verification.last_sent_at).total_seconds() < 60
        ):
            return Response(
                {"detail": "Please wait before requesting another code."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        code = f"{secrets.randbelow(1_000_000):06d}"
        old_phone_number = request.user.phone_number
        old_is_phone_verified = request.user.is_phone_verified
        request.user.phone_number = phone_number
        request.user.is_phone_verified = False
        request.user.save(update_fields=("phone_number", "is_phone_verified"))
        verification, _ = PhoneVerification.objects.update_or_create(
            user=request.user,
            defaults={
                "phone_number": phone_number,
                "code_hash": make_password(code),
                "expires_at": timezone.now() + timedelta(minutes=10),
                "last_sent_at": timezone.now(),
                "attempts": 0,
            },
        )
        try:
            send_sms(phone_number, f"Your RiceHub verification code is {code}.")
        except SMSConfigurationError:
            verification.delete()
            request.user.phone_number = old_phone_number
            request.user.is_phone_verified = old_is_phone_verified
            request.user.save(
                update_fields=("phone_number", "is_phone_verified")
            )
            return Response(
                {"detail": "Phone verification is temporarily unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except SMSDeliveryError:
            verification.delete()
            request.user.phone_number = old_phone_number
            request.user.is_phone_verified = old_is_phone_verified
            request.user.save(
                update_fields=("phone_number", "is_phone_verified")
            )
            return Response(
                {"detail": "The verification code could not be sent. Try again later."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response(
            {"detail": "A verification code has been sent."},
            status=status.HTTP_200_OK,
        )

    def verify_code(self, request, phone_number):
        code = request.data.get("code")
        if not isinstance(code, str) or not re.fullmatch(r"\d{6}", code):
            return Response(
                {"code": "Enter the 6-digit code."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            verification = request.user.phone_verification
        except PhoneVerification.DoesNotExist:
            return Response(
                {"detail": "Request a new verification code."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if (
            verification.phone_number != phone_number
            or timezone.now() >= verification.expires_at
            or verification.attempts >= 5
        ):
            return Response(
                {"detail": "The verification code is invalid or expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not check_password(code, verification.code_hash):
            verification.attempts += 1
            verification.save(update_fields=("attempts",))
            return Response(
                {"detail": "The verification code is invalid or expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        request.user.phone_number = phone_number
        request.user.is_phone_verified = True
        request.user.save(update_fields=("phone_number", "is_phone_verified"))
        verification.delete()
        return Response({"detail": "Phone number verified."})


class ContactSuggestionsView(APIView):
    permission_classes = [IsActiveAndNotSuspended]

    def post(self, request):
        from friendships.services import get_friend_ids

        phone_numbers = request.data.get("phone_numbers")
        if not isinstance(phone_numbers, list) or len(phone_numbers) > 500:
            return Response(
                {"phone_numbers": "Provide at most 500 phone numbers."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        normalized_numbers = set()
        for phone_number in phone_numbers:
            if (
                not isinstance(phone_number, str)
                or not PhoneVerificationView.phone_pattern.fullmatch(
                    phone_number.strip()
                )
            ):
                return Response(
                    {"phone_numbers": "All numbers must use international format."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            normalized_numbers.add(phone_number.strip())

        users = User.objects.filter(
            phone_number__in=normalized_numbers,
            is_phone_verified=True,
            is_active=True,
            is_suspended=False,
            privacy_settings__discoverable_by_phone=True,
        ).exclude(pk=request.user.pk).exclude(
            pk__in=get_friend_ids(request.user)
        ).order_by("username")[:50]
        return Response(
            UserSerializer(
                users,
                many=True,
                context={"request": request},
            ).data
        )


class ResendVerificationCodeView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [RegisterRateThrottle]

    def post(self, request):
        if settings.EMAIL_BACKEND == "django.core.mail.backends.smtp.EmailBackend" and not all(
            (
                settings.EMAIL_HOST,
                settings.EMAIL_HOST_USER,
                settings.EMAIL_HOST_PASSWORD,
                settings.DEFAULT_FROM_EMAIL,
            )
        ):
            logger.error(
                "Email verification resend requested, but SMTP sender "
                "configuration is incomplete."
            )
            return Response(
                {
                    "detail": (
                        "Email verification is temporarily unavailable. "
                        "Please try again later."
                    )
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

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
            try:
                send_verification_code(user, verification)
            except (OSError, smtplib.SMTPException):
                logger.exception(
                    "Email verification code could not be sent for user %s.",
                    user.pk,
                )
                return Response(
                    {
                        "detail": (
                            "Email verification is temporarily unavailable. "
                            "Please try again later."
                        )
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
        return Response(
            {
                "message": "If the account can be verified, a code has been sent.",
                "detail": "If the account can be verified, a code has been sent.",
            },
            status=status.HTTP_200_OK,
        )


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def get_throttles(self):
        return [LoginRateThrottle(), *super().get_throttles()]

    def post(self, request):
        username = request.data.get("username", "")
        password = request.data.get("password")

        if not isinstance(username, str) or not isinstance(password, str):
            return Response(
                {"error": "Username and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        username = username.strip()
        if not username or not password:
            return Response(
                {"error": "Username and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.filter(username__iexact=username).first()

        if not user:
            record_security_event(
                None,
                SecurityEvent.EventType.LOGIN_FAILED,
                request,
            )
            return Response(
                {
                    "code": "user_not_found",
                    "detail": (
                        "No account was found with this username. "
                        "Create a new account."
                    ),
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        if not user.check_password(password):
            record_security_event(
                user,
                SecurityEvent.EventType.LOGIN_FAILED,
                request,
            )
            return Response(
                {"error": "Invalid credentials."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if is_user_suspended(user):
            record_security_event(
                user,
                SecurityEvent.EventType.LOGIN_FAILED,
                request,
            )
            return Response(
                {"error": "Account is suspended. Contact support for assistance."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not user.is_active:
            record_security_event(
                user,
                SecurityEvent.EventType.LOGIN_FAILED,
                request,
            )
            return Response(
                {"error": "Account is disabled."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if UserSecuritySettings.objects.filter(
            user=user,
            two_factor_enabled=True,
        ).exists():
            try:
                send_two_factor_code(user, TwoFactorChallenge.Purpose.LOGIN)
            except (OSError, smtplib.SMTPException):
                logger.exception(
                    "Two-factor login email could not be sent for user %s.",
                    user.pk,
                )
                return Response(
                    {
                        "detail": (
                            "The sign-in verification email could not be sent. "
                            "Please try again later."
                        )
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            return Response(
                {
                    "two_factor_required": True,
                    "username": user.username,
                    "email": mask_email(user.email),
                },
                status=status.HTTP_200_OK,
            )

        record_security_event(
            user,
            SecurityEvent.EventType.LOGIN,
            request,
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

    def get_throttles(self):
        return [LoginRateThrottle(), *super().get_throttles()]

    def post(self, request):
        username = request.data.get("username", "")
        code = request.data.get("code", "")
        if not isinstance(username, str) or not isinstance(code, str):
            return Response(
                {"detail": "Invalid verification code."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        username = username.strip()
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
            record_security_event(
                user,
                SecurityEvent.EventType.LOGIN_FAILED,
                request,
            )
            return Response(
                {"detail": error},
                status=status.HTTP_400_BAD_REQUEST,
            )

        challenge.delete()
        record_security_event(
            user,
            SecurityEvent.EventType.LOGIN,
            request,
        )
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "refresh": str(refresh),
                "access": str(refresh.access_token),
            },
            status=status.HTTP_200_OK,
        )


class MeView(APIView):
    permission_classes = [IsActiveAndNotSuspended]

    def get(self, request):
        user = request.user
        return Response(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "is_email_verified": user.is_email_verified,
                "is_verified": user.is_verified,
                "subscription_expires_at": user.subscription_expires_at,
                "phone_number": user.phone_number,
                "is_phone_verified": user.is_phone_verified,
                "preferred_language": user.preferred_language,
            },
            status=status.HTTP_200_OK,
        )


class ProfileUpdateView(APIView):
    permission_classes = [IsActiveAndNotSuspended]

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
    permission_classes = [IsActiveAndNotSuspended]
    throttle_classes = [PasswordRateThrottle]

    def get(self, request):
        settings_obj, _ = UserSecuritySettings.objects.get_or_create(
            user=request.user
        )
        return Response(
            {
                "two_factor_enabled": settings_obj.two_factor_enabled,
                "email_verified": request.user.is_email_verified,
                "email": mask_email(request.user.email),
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        action = request.data.get("action")
        password = request.data.get("password", "")
        if not isinstance(password, str) or not request.user.check_password(password):
            return Response(
                {"detail": "The password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if action == "disable":
            settings_obj, _ = UserSecuritySettings.objects.get_or_create(
                user=request.user
            )
            if not settings_obj.two_factor_enabled:
                return Response(
                    {"detail": "Two-factor authentication is already disabled."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            settings_obj.two_factor_enabled = False
            settings_obj.save(update_fields=["two_factor_enabled"])
            TwoFactorChallenge.objects.filter(user=request.user).delete()
            return Response(
                {"two_factor_enabled": False},
                status=status.HTTP_200_OK,
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
            if not request.user.is_email_verified:
                return Response(
                    {"detail": "Verify your email before enabling two-step verification."},
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
    permission_classes = [IsActiveAndNotSuspended]
    throttle_classes = [PasswordRateThrottle]

    def post(self, request):
        current_refresh = request.data.get("refresh")
        if not isinstance(current_refresh, str) or not current_refresh:
            return Response(
                {"refresh": ["Your current refresh token is required."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            current_token = RefreshToken(current_refresh)
            current_user_id = current_token["user_id"]
            current_jti = current_token["jti"]
        except (TokenError, KeyError) as error:
            return Response(
                {"refresh": ["The current refresh token is invalid or expired."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if str(current_user_id) != str(request.user.pk):
            return Response(
                {"refresh": ["The refresh token does not belong to this account."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        tokens = OutstandingToken.objects.filter(
            user=request.user,
            expires_at__gt=timezone.now(),
        ).exclude(jti=current_jti)
        revoked = 0
        for token in tokens:
            _, created = BlacklistedToken.objects.get_or_create(token=token)
            revoked += int(created)

        return Response(
            {
                "detail": "Other sessions have been signed out.",
                "revoked_sessions": revoked,
            },
            status=status.HTTP_200_OK,
        )


class UserPrivacySettingsView(APIView):
    permission_classes = [IsActiveAndNotSuspended]

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
    permission_classes = [IsActiveAndNotSuspended]

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


class MutedUserView(APIView):
    permission_classes = [IsActiveAndNotSuspended]

    def get(self, request, user_id):
        if user_id == request.user.pk:
            return Response({"muted": False})
        return Response({
            "muted": MutedUser.objects.filter(
                muter=request.user,
                muted_id=user_id,
            ).exists()
        })

    def post(self, request, user_id):
        muted_user = get_object_or_404(User, pk=user_id)
        if muted_user.pk == request.user.pk:
            return Response(
                {"detail": "You cannot mute yourself."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        muted, created = MutedUser.objects.get_or_create(
            muter=request.user,
            muted=muted_user,
        )
        return Response(
            {"muted": True},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request, user_id):
        deleted, _ = MutedUser.objects.filter(
            muter=request.user,
            muted_id=user_id,
        ).delete()
        if not deleted:
            return Response(
                {"detail": "Muted user not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class AccountReportCreateView(ModerationThrottleMixin, APIView):
    permission_classes = [IsActiveAndNotSuspended]
    throttle_classes = [ReportRateThrottle]

    @transaction.atomic
    def post(self, request):
        User.objects.select_for_update().only("pk").get(pk=request.user.pk)
        reported_user = get_object_or_404(User, pk=request.data.get("user_id"))
        if reported_user.pk == request.user.pk:
            return Response(
                {"detail": "You cannot report your own account."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        reason = request.data.get("reason")
        allowed_reasons = {choice for choice, _ in AccountReport.Reason.choices}
        if reason not in allowed_reasons:
            return Response(
                {"reason": "Choose a valid report reason."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        details = str(request.data.get("details", "")).strip()
        if len(details) > 2000:
            return Response(
                {"details": "Details must be 2000 characters or fewer."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if AccountReport.objects.filter(
            reporter=request.user,
            reported_user=reported_user,
            status=AccountReport.Status.OPEN,
        ).exists():
            return Response(
                {"detail": "You already have an open report for this account."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        report = AccountReport.objects.create(
            reporter=request.user,
            reported_user=reported_user,
            reason=reason,
            details=details,
        )
        return Response(
            {"id": report.pk, "detail": "Your report was submitted."},
            status=status.HTTP_201_CREATED,
        )


class SupportRequestCreateView(APIView):
    permission_classes = [IsActiveAndNotSuspended]
    throttle_classes = [ReportRateThrottle]

    def post(self, request):
        subject = str(request.data.get("subject", "")).strip()
        details = str(request.data.get("details", "")).strip()
        if not subject or len(subject) > 200:
            return Response(
                {"subject": "Enter a subject of 1 to 200 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not details or len(details) > 5000:
            return Response(
                {"details": "Enter details of 1 to 5000 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        support_request = SupportRequest.objects.create(
            reporter=request.user,
            subject=subject,
            details=details,
        )
        return Response(
            {
                "id": support_request.pk,
                "detail": "Your support request was submitted.",
            },
            status=status.HTTP_201_CREATED,
        )


class UserSearchView(GenericAPIView):
    permission_classes = [IsActiveAndNotSuspended]
    pagination_class = StandardPagination

    def get(self, request):
        query = request.query_params.get(
            "q",
            request.query_params.get("search", ""),
        ).strip()
        if len(query) < 2:
            return Response(
                {
                    "count": 0,
                    "next": None,
                    "previous": None,
                    "results": [],
                },
                status=status.HTTP_200_OK,
            )

        users = search_users(request.user, query)
        page = self.paginate_queryset(users)
        return Response(
            self.get_paginated_response(
                UserSerializer(
                    page,
                    many=True,
                    context={"request": request},
                ).data
            ).data,
        )


class UserDetailView(APIView):
    permission_classes = [IsActiveAndNotSuspended]

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
    permission_classes = [IsActiveAndNotSuspended]

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
    throttle_classes = [PasswordRateThrottle]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            serializer.save()
        except (smtplib.SMTPException, OSError):
            logger.exception("Password reset email sending failed")
            return Response(
                {"detail": "Password reset email is temporarily unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

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
    permission_classes = [IsActiveAndNotSuspended]

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
    permission_classes = [IsActiveAndNotSuspended]
    throttle_classes = [PasswordRateThrottle]

    @transaction.atomic
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
        record_security_event(
            request.user,
            SecurityEvent.EventType.ACCOUNT_DELETED,
            request,
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