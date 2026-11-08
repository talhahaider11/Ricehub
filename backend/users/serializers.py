
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from django.utils import timezone

from rest_framework import serializers
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)

from friendships.services import get_friend_ids
from friendships.models import FriendRequest
from .models import (
    BlockedUser,
    EmailVerification,
    UserPrivacySettings,
    UserSecuritySettings,
)
from .password_reset import send_password_reset_email
from .presence import is_user_online
from .validators import validate_strong_password
from .verification import OTP_MAX_ATTEMPTS

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    profile_picture = serializers.SerializerMethodField()
    cover_picture = serializers.SerializerMethodField()
    is_online = serializers.SerializerMethodField()
    is_email_verified = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()
    last_seen = serializers.SerializerMethodField()
    friends_count = serializers.SerializerMethodField()
    posts_count = serializers.SerializerMethodField()
    is_staff = serializers.SerializerMethodField()
    phone_number = serializers.SerializerMethodField()
    subscription_expires_at = serializers.SerializerMethodField()
    friendship_status = serializers.SerializerMethodField()
    friend_request_id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "bio", "profile_picture", "cover_picture", "location",
            "website", "date_of_birth", "profile_visibility",
            "is_online", "last_seen", "created_at",
            "is_email_verified",
            "is_verified", "subscription_expires_at", "phone_number",
            "is_phone_verified", "preferred_language",
            "friends_count", "posts_count", "is_staff",
            "friendship_status", "friend_request_id",
        ]
        read_only_fields = [
            "id", "is_online", "last_seen", "created_at",
            "is_email_verified",
        ]

    def get_profile_picture(self, obj):
        request = self.context.get("request")
        if not obj.profile_picture:
            return None
        url = obj.profile_picture.url
        return request.build_absolute_uri(url) if request else url

    def get_cover_picture(self, obj):
        request = self.context.get("request")
        if not obj.cover_picture:
            return None
        url = obj.cover_picture.url
        return request.build_absolute_uri(url) if request else url

    def get_is_email_verified(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated and request.user.pk == obj.pk:
            return obj.is_email_verified
        return None

    def get_email(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated and request.user.pk == obj.pk:
            return obj.email
        return None

    def get_phone_number(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated and request.user.pk == obj.pk:
            return obj.phone_number
        return None

    def get_subscription_expires_at(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated and request.user.pk == obj.pk:
            return obj.subscription_expires_at
        return None

    def get_is_online(self, obj):
        if not self._privacy_setting(obj, "show_activity_status", True):
            return None
        return is_user_online(obj)

    def get_last_seen(self, obj):
        if not self._privacy_setting(obj, "show_last_seen", True):
            return None
        return obj.last_seen

    def get_friends_count(self, obj):
        return len(get_friend_ids(obj))

    def get_friendship_status(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated or request.user.pk == obj.pk:
            return "self" if request and request.user.is_authenticated else "none"
        if obj.pk in get_friend_ids(request.user):
            return "friends"
        if FriendRequest.objects.filter(
            sender=request.user,
            receiver=obj,
            status=FriendRequest.Status.PENDING,
        ).exists():
            return "outgoing_pending"
        if FriendRequest.objects.filter(
            sender=obj,
            receiver=request.user,
            status=FriendRequest.Status.PENDING,
        ).exists():
            return "incoming_pending"
        return "none"

    def get_friend_request_id(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated or request.user.pk == obj.pk:
            return None
        pending = FriendRequest.objects.filter(
            sender=request.user,
            receiver=obj,
            status=FriendRequest.Status.PENDING,
        ).only("pk").first()
        if not pending:
            pending = FriendRequest.objects.filter(
                sender=obj,
                receiver=request.user,
                status=FriendRequest.Status.PENDING,
            ).only("pk").first()
        return pending.pk if pending else None

    def get_posts_count(self, obj):
        return obj.posts.count()

    def get_is_staff(self, obj):
        request = self.context.get("request")
        return bool(
            request
            and request.user.is_authenticated
            and request.user.pk == obj.pk
            and obj.is_staff
        )

    @staticmethod
    def _privacy_setting(user, field, default):
        try:
            return getattr(user.privacy_settings, field)
        except UserPrivacySettings.DoesNotExist:
            return default


class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "first_name",
            "last_name",
            "bio",
            "profile_picture",
            "cover_picture",
            "location",
            "website",
            "date_of_birth",
            "profile_visibility",
            "preferred_language",
        ]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        trim_whitespace=False,
    )

    class Meta:
        model = User
        fields = [
            "username", "email", "first_name",
            "last_name", "password", "preferred_language",
        ]

    def validate_password(self, value):
        validate_strong_password(value)
        return value

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError(
                "This username is already taken. Please choose another one."
            )
        return value

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                "An account with this email already exists."
            )
        return value

    def create(self, validated_data):
        # set_password automatic hash apply karta hai aur is_active=True karta hai
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password']
        )
        user.is_active = True
        user.save()
        return user


def suggest_usernames(username, count=3):
    max_length = User._meta.get_field("username").max_length
    suggestions = []
    suffix = 1

    while len(suggestions) < count:
        suffix_text = str(suffix)
        candidate = (
            f"{username[:max_length - len(suffix_text)]}{suffix_text}"
        )
        if not User.objects.filter(username__iexact=candidate).exists():
            suggestions.append(candidate)
        suffix += 1

    return suggestions


class UserPrivacySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPrivacySettings
        exclude = ["id", "user"]


class UserSecuritySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserSecuritySettings
        fields = ["two_factor_enabled"]


class BlockedUserSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="blocked_id", read_only=True)
    username = serializers.CharField(
        source="blocked.username", read_only=True
    )
    first_name = serializers.CharField(
        source="blocked.first_name", read_only=True
    )
    last_name = serializers.CharField(
        source="blocked.last_name", read_only=True
    )

    class Meta:
        model = BlockedUser
        fields = [
            "id", "username", "first_name",
            "last_name", "created_at",
        ]


class EmailVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.RegexField(r"^\d{6}$")

    def validate(self, attrs):
        email = attrs["email"].strip()

        user = User.objects.filter(
            email__iexact=email,
            is_email_verified=False,
        ).first()

        if not user:
            raise serializers.ValidationError({
                "detail": "Invalid email or verification code."
            })

        try:
            verification = user.email_verification
        except EmailVerification.DoesNotExist:
            raise serializers.ValidationError({
                "detail": "Invalid email or verification code."
            })

        if verification.attempts >= OTP_MAX_ATTEMPTS:
            raise serializers.ValidationError({
                "detail": "Too many attempts. Request a new code."
            })

        if verification.is_expired() or not verification.code_hash:
            raise serializers.ValidationError({
                "detail": "Code expired or invalid. Request a new code."
            })

        if not check_password(
            attrs["code"],
            verification.code_hash,
        ):
            verification.attempts += 1
            verification.save(update_fields=["attempts"])

            if verification.attempts >= OTP_MAX_ATTEMPTS:
                raise serializers.ValidationError({
                    "detail": "Too many attempts. Request a new code."
                })

            raise serializers.ValidationError({
                "detail": "Invalid email or verification code."
            })

        attrs["user"] = user
        attrs["verification"] = verification
        return attrs

    @transaction.atomic
    def save(self, **kwargs):
        user = User.objects.select_for_update().get(
            pk=self.validated_data["user"].pk
        )
        verification = EmailVerification.objects.select_for_update().get(
            pk=self.validated_data["verification"].pk,
            user=user,
        )

        # Recheck conditions to prevent stale validation from activating
        # an account after a resend or expiration.
        if (
            user.is_email_verified
            or verification.is_expired()
            or not verification.code_hash
            or verification.attempts >= OTP_MAX_ATTEMPTS
            or not check_password(
                self.validated_data["code"],
                verification.code_hash,
            )
        ):
            raise serializers.ValidationError({
                "detail": "Invalid or expired verification code."
            })

        user.is_email_verified = True
        user.is_active = True
        user.save(update_fields=["is_email_verified", "is_active"])
        verification.delete()
        return user


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def save(self, **kwargs):
        user = User.objects.filter(
            email__iexact=self.validated_data["email"],
            is_active=True,
        ).first()

        if user:
            send_password_reset_email(
                user,
                getattr(settings, "FRONTEND_URL", ""),
            )

        return user


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        trim_whitespace=False,
    )

    def validate(self, attrs):
        try:
            uid = force_str(urlsafe_base64_decode(attrs["uid"]))
            user = User.objects.get(pk=uid)
        except (
            ValueError, TypeError, OverflowError, User.DoesNotExist
        ):
            raise serializers.ValidationError("Invalid reset link.")

        if not default_token_generator.check_token(
            user, attrs["token"]
        ):
            raise serializers.ValidationError(
                "Invalid or expired reset link."
            )

        try:
            validate_strong_password(attrs["password"])
            validate_password(attrs["password"], user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(
                {"password": exc.messages}
            ) from exc
        attrs["user"] = user
        return attrs

    def save(self, **kwargs):
        user = self.validated_data["user"]
        with transaction.atomic():
            user.set_password(self.validated_data["password"])
            user.save(update_fields=["password"])
            revoke_user_refresh_tokens(user)
        return user


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
    )
    new_password = serializers.CharField(
        write_only=True,
        min_length=8,
        trim_whitespace=False,
    )

    def validate(self, attrs):
        user = self.context["request"].user
        if not user.check_password(attrs["current_password"]):
            raise serializers.ValidationError(
                {"current_password": "Your current password is incorrect."}
            )
        if user.check_password(attrs["new_password"]):
            raise serializers.ValidationError(
                {"new_password": "Choose a password you have not used before."}
            )

        try:
            validate_strong_password(attrs["new_password"])
            validate_password(attrs["new_password"], user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(
                {"new_password": exc.messages}
            ) from exc
        attrs["user"] = user
        return attrs

    def save(self, **kwargs):
        user = self.validated_data["user"]
        with transaction.atomic():
            user.set_password(self.validated_data["new_password"])
            user.save(update_fields=["password"])
            revoke_user_refresh_tokens(user)
        return user


def revoke_user_refresh_tokens(user):
    outstanding_tokens = OutstandingToken.objects.filter(
        user=user,
        expires_at__gt=timezone.now(),
    )
    for token in outstanding_tokens:
        BlacklistedToken.objects.get_or_create(token=token)
