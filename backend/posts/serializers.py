from django.contrib.auth import get_user_model

from rest_framework import serializers

from .models import Hashtag, Post
from .hashtag_services import sync_post_hashtags


User = get_user_model()

class MediaURLField(serializers.FileField):
    def to_representation(self, value):
        if not value:
            return None
        url = value.url
        request = self.context.get("request")
        return request.build_absolute_uri(url) if request else url


class PostAuthorSerializer(serializers.ModelSerializer):

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


class PostSerializer(serializers.ModelSerializer):

    author = PostAuthorSerializer(
        read_only=True
    )

    image = MediaURLField(required=False, allow_null=True)
    video = MediaURLField(required=False, allow_null=True)

    comments_count = serializers.IntegerField(
        read_only=True
    )

    reactions_count = serializers.IntegerField(
        read_only=True
    )

    my_reaction = serializers.SerializerMethodField()

    hashtags = serializers.ListField(
        child=serializers.CharField(
            max_length=100
        ),
        required=False,
        allow_empty=True,
        write_only=True,
    )

    hashtag_list = serializers.SerializerMethodField()

    class Meta:
        model = Post

        fields = [
            "id",
            "author",
            "content",
            "image",
            "video",
            "visibility",
            "hashtags",
            "hashtag_list",
            "comments_count",
            "reactions_count",
            "my_reaction",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "author",
            "comments_count",
            "reactions_count",
            "created_at",
            "updated_at",
            "hashtag_list",
            "my_reaction",
        ]

    def get_hashtag_list(self, obj):

        return [
            hashtag.name
            for hashtag in obj.hashtags.all()
        ]

    def get_my_reaction(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None

        if hasattr(obj, "current_user_reactions"):
            reactions = obj.current_user_reactions
        elif hasattr(obj, "all_post_reactions"):
            reactions = [
                reaction
                for reaction in obj.all_post_reactions
                if reaction.user_id == request.user.pk
            ]
        else:
            reactions = obj.reactions.filter(user=request.user)[:1]
        return reactions[0].reaction_type if reactions else None

    def validate_visibility(self, value):

        valid_values = {
            choice[0]
            for choice in Post.Visibility.choices
        }

        if value not in valid_values:
            raise serializers.ValidationError(
                "Invalid visibility."
            )

        return value

    def validate(self, attrs):

        content = attrs.get(
            "content",
            ""
        ).strip()

        image = attrs.get("image")
        video = attrs.get("video")

        if not content and not image and not video:
            raise serializers.ValidationError(
                "A post must contain text, an image or a video."
            )
        if image and video:
            raise serializers.ValidationError("Add an image or a video, not both.")

        attrs["content"] = content

        return attrs

    def create(self, validated_data):

        validated_data.pop(
            "hashtags",
            None
        )

        post = super().create(
            validated_data
        )

        sync_post_hashtags(post)

        return post

    def update(self, instance, validated_data):

        validated_data.pop(
            "hashtags",
            None
        )

        post = super().update(
            instance,
            validated_data
        )

        sync_post_hashtags(post)

        return post

class HashtagSerializer(
    serializers.ModelSerializer
):
    class Meta:
        model = Hashtag
        fields = [
            "id",
            "name",
            "created_at",
        ]