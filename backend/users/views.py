import logging
import socket
from smtplib import SMTPException

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from rest_framework import generics, status
from rest_framework.decorators import api_view
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import (
    BlockedUser,
    EmailVerification,
    ProfileVisibility,
    TwoFactorChallenge,
    UserPrivacySettings,
    UserSecuritySettings,
)
from .permissions import CanViewProfile
from .privacy import get_blocked_user_ids
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
from .throttles import LoginRateThrottle
from .two_factor import mask_email, send_two_factor_code, verify_two_factor_code
from .verification import send_verification_code
from friendships.services import get_friend_ids

logger = logging.getLogger(__name__)
User = get_user_model()

def revoke_user_refresh_tokens(user):
    from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)

# --- AUTH & 2FA ---

class VerifiedTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        if not self.user.is_email_verified:
            raise AuthenticationFailed({
                "detail": "Verify your email before signing in.",
                "code": "email_not_verified",
                "email": self.user.email,
            })
        
        security_settings, _ = UserSecuritySettings.objects.get_or_create(user=self.user)
        if security_settings.two_factor_enabled:
            RefreshToken(data["refresh"]).blacklist()
            try:
                send_two_factor_code(self.user, TwoFactorChallenge.Purpose.LOGIN)
            except (SMTPException, OSError, socket.timeout) as error:
                logger.exception("Unable to send two-factor code for user %s", self.user.pk)
                raise AuthenticationFailed({
                    "detail": "The sign-in code could not be sent. Check email settings and try again.",
                    "code": "two_factor_email_unavailable",
                }) from error
            return {
                "two_factor_required": True,
                "email": mask_email(self.user.email),
                "username": self.user.username,
            }
        return data

class LoginView(TokenObtainPairView):
    throttle_classes = [LoginRateThrottle]
    serializer_class = VerifiedTokenObtainPairSerializer

class VerifyTwoFactorLoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        username = request.data.get("username", "")
        code = request.data.get("code", "")
        if not isinstance(username, str) or not isinstance(code, str) or not code.isdigit() or len(code) != 6:
            return Response({"detail": "Enter the username and 6-digit verification code."}, status=400)

        user = User.objects.filter(username__iexact=username).first()
        if not user or not user.is_active or not user.is_email_verified:
            return Response({"detail": "The verification code is invalid or expired."}, status=400)

        try:
            challenge = user.two_factor_challenge
        except TwoFactorChallenge.DoesNotExist:
            return Response({"detail": "The verification code is invalid or expired."}, status=400)

        if challenge.purpose != TwoFactorChallenge.Purpose.LOGIN:
            return Response({"detail": "The verification code is invalid or expired."}, status=400)

        valid, detail = verify_two_factor_code(challenge, code)
        if not valid:
            return Response({"detail": detail}, status=400)

        challenge.delete()
        refresh = RefreshToken.for_user(user)
        return Response({"refresh": str(refresh), "access": str(refresh.access_token)})

# --- REGISTER & EMAIL VERIFY ---

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            user = serializer.save()
            verification, _ = EmailVerification.objects.get_or_create(user=user)

        try:
            send_verification_code(user, verification)
        except Exception as e:
            logger.error(f"Email delivery failed for user {user.pk}: {str(e)}")
            return Response({
                "detail": "Your account was created, but verification email could not be sent.",
                "email": user.email,
                "verification_required": True,
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        return Response({
            "message": "Account created. Check your email for the verification code.",
            "email": user.email,
            "verification_required": True,
        }, status=201)

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
        try:
            validate_email(email)
        except ValidationError:
            return Response({"email": ["Enter a valid email address."]}, status=400)

        user = User.objects.filter(email__iexact=email, is_email_verified=False).first()
        if not user:
            return Response({"detail": "If the account needs verification, a new code will be sent."})

        verification, _ = EmailVerification.objects.get_or_create(user=user)
        if verification.last_sent_at:
            retry_after = 60 - int((timezone.now() - verification.last_sent_at).total_seconds())
            if retry_after > 0:
                return Response({"detail": f"Please wait {retry_after} seconds."}, status=429)

        try:
            send_verification_code(user, verification)
        except (SMTPException, OSError, socket.timeout):
            return Response({"detail": "Verification email could not be sent."}, status=503)
        
        return Response({"detail": "If the account needs verification, a new code will be sent."})

# --- USER PROFILE & SETTINGS ---

class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        return Response(UserSerializer(request.user, context={"request": request}).data)

MeView = CurrentUserView

class CurrentUserUpdateView(generics.UpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    def get_object(self):
        return self.request.user
    def get_serializer_context(self):
        return {"request": self.request}

ProfileUpdateView = CurrentUserUpdateView

class UserDetailView(generics.RetrieveAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, CanViewProfile]
    lookup_field = "id"
    def get_serializer_context(self):
        return {"request": self.request}

class UserByUsernameView(generics.RetrieveAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, CanViewProfile]
    lookup_field = "username"

class UserSearchView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self):
        query = self.request.query_params.get("q", "").strip()
        if not query:
            return User.objects.none()
        blocked_ids = get_blocked_user_ids(self.request.user)
        searchable = Q(username__icontains=query) | Q(first_name__icontains=query) | Q(last_name__icontains=query)
        if "@" in query:
            searchable |= Q(email__iexact=query, privacy_settings__discoverable_by_email=True)
        visible = Q(profile_visibility=ProfileVisibility.PUBLIC) | Q(profile_visibility=ProfileVisibility.FRIENDS, id__in=get_friend_ids(self.request.user))
        return User.objects.filter(searchable, visible, is_active=True).exclude(id__in=blocked_ids | {self.request.user.id}).order_by("username")
    def get_serializer_context(self):
        return {"request": self.request}

# ... Baqi views (TwoFactorSettingsView, BlockedUsersView, etc) same rahenge jaise aapke code me hain
# users/views.py me file ke aakhir me yeh view add karein:

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions

class AccountDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request):
        user = request.user
        user.delete()
        return Response({"message": "Account deleted successfully."}, status=status.HTTP_204_NO_CONTENT)