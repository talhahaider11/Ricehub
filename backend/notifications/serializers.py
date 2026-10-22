from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import Notification, NotificationPreference
from .models import UserDevice

User = get_user_model()


class NotificationSenderSerializer(
    serializers.ModelSerializer
):

    profile_picture = serializers.SerializerMethodField()

    class Meta:
        model = User

        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "profile_picture",
        ]

    def get_profile_picture(self, obj):

        request = self.context.get("request")

        if not obj.profile_picture:
            return None

        url = obj.profile_picture.url

        if request:
            return request.build_absolute_uri(url)

        return url


class NotificationSerializer(
    serializers.ModelSerializer
):

    sender = NotificationSenderSerializer(
        read_only=True
    )

    class Meta:
        model = Notification

        fields = [
            "id",
            "sender",
            "notification_type",
            "message",
            "post_id",
            "comment_id",
            "conversation_id",
            "is_read",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
        ]

class UserDeviceSerializer(
    serializers.ModelSerializer
):
    token = serializers.CharField(
        max_length=4096,
        trim_whitespace=True,
    )

    class Meta:
        model = UserDevice
        fields = [
            "id",
            "token",
            "platform",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]

    def validate_token(self, value):
        if not value:
            raise serializers.ValidationError(
                "A push notification token is required."
            )
        return value


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = [
            "friend_requests",
            "friend_accepted",
            "comments",
            "reactions",
            "messages",
            "event_invitations",
            "all_notifications",
        ]