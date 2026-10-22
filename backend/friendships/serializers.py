from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import FriendRequest
from users.presence import is_user_online
from users.models import UserPrivacySettings


User = get_user_model()


class FriendUserSerializer(
    serializers.ModelSerializer
):

    profile_picture = serializers.SerializerMethodField()
    is_online = serializers.SerializerMethodField()
    last_seen = serializers.SerializerMethodField()

    class Meta:
        model = User

        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "profile_picture",
            "is_online",
            "last_seen",
        ]

    def get_is_online(self, obj):
        try:
            if not obj.privacy_settings.show_activity_status:
                return None
        except UserPrivacySettings.DoesNotExist:
            pass
        return is_user_online(obj)

    def get_last_seen(self, obj):
        try:
            if not obj.privacy_settings.show_last_seen:
                return None
        except UserPrivacySettings.DoesNotExist:
            pass
        return obj.last_seen

    def get_profile_picture(self, obj):

        request = self.context.get("request")

        if not obj.profile_picture:
            return None

        url = obj.profile_picture.url

        if request:
            return request.build_absolute_uri(url)

        return url


class FriendRequestSerializer(
    serializers.ModelSerializer
):

    sender = FriendUserSerializer(
        read_only=True
    )

    receiver = FriendUserSerializer(
        read_only=True
    )

    class Meta:
        model = FriendRequest

        fields = [
            "id",
            "sender",
            "receiver",
            "status",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "sender",
            "receiver",
            "status",
            "created_at",
            "updated_at",
        ]