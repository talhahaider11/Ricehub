from rest_framework import serializers

from users.models import User, UserPrivacySettings
from users.presence import is_user_online
from posts.models import Post, Hashtag
from media_app.serializers import MediaAssetSerializer


class SearchUserSerializer(
    serializers.ModelSerializer
):
    is_online = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "profile_picture",
            "is_online",
        ]

    def get_is_online(self, obj):
        try:
            if not obj.privacy_settings.show_activity_status:
                return None
        except UserPrivacySettings.DoesNotExist:
            pass
        return is_user_online(obj)


class SearchPostSerializer(
    serializers.ModelSerializer
):
    author = SearchUserSerializer(read_only=True)
    media_assets = MediaAssetSerializer(many=True, read_only=True)

    class Meta:
        model = Post
        fields = [
            "id",
            "author",
            "content",
            "post_type",
            "image",
            "video",
            "media_assets",
            "visibility",
            "created_at",
        ]


class SearchHashtagSerializer(
    serializers.ModelSerializer
):
    post_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Hashtag
        fields = [
            "id",
            "name",
            "post_count",
        ]