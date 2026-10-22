from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import Comment
User = get_user_model()
class CommentAuthorSerializer(serializers.ModelSerializer):
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
class CommentSerializer(serializers.ModelSerializer):
    author = CommentAuthorSerializer(
        read_only=True
    )
    replies_count = serializers.IntegerField(
        read_only=True
    )
    class Meta:
        model = Comment
        fields = [
            "id",
            "post",
            "author",
            "parent",
            "content",
            "replies_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "post",
            "author",
            "replies_count",
            "created_at",
            "updated_at",
        ]
def validate_content(self, value):
    value = value.strip()
    if not value:
        raise serializers.ValidationError(
            "Comment cannot be empty."
        )
    if len(value) > 2000:
        raise serializers.ValidationError(
            "Comment cannot exceed 2000 characters."
        )
    return value