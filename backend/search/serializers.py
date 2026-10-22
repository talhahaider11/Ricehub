from rest_framework import serializers

from users.models import User
from posts.models import Post, Hashtag


class SearchUserSerializer(
    serializers.ModelSerializer
):
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


class SearchPostSerializer(
    serializers.ModelSerializer
):
    class Meta:
        model = Post
        fields = [
            "id",
            "content",
            "image",
            "created_at",
        ]


class SearchHashtagSerializer(
    serializers.ModelSerializer
):
    class Meta:
        model = Hashtag
        fields = [
            "id",
            "name",
        ]