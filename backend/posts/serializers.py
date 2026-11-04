import re

from django.contrib.auth import get_user_model
from feed.cache import invalidate_feed

from rest_framework import serializers

from media_app.models import MediaAsset
from media_app.serializers import MediaAssetSerializer
from .models import Hashtag, Post
from .hashtag_services import sync_post_hashtags


User = get_user_model()

class MediaURLField(serializers.FileField):
    def to_representation(self, value):
        if not value:
            return None
        url = value.url
        if url.startswith(("http://", "https://", "//")):
            return url
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
            "is_verified",
        ]

    def get_profile_picture(self, obj):

        request = self.context.get("request")

        if not obj.profile_picture:
            return None

        url = obj.profile_picture.url

        if url.startswith(("http://", "https://", "//")):
            return url
        if request:
            return request.build_absolute_uri(url)

        return url


class PostSerializer(serializers.ModelSerializer):
    RICE_CONTENT_TERMS = (
        "rice",
        "paddy",
        "basmati",
        "sella",
        "parboiled",
        "rice mill",
        "rice farming",
        "rice harvest",
        "چاول",
        "دھان",
        "باسمتی",
    )

    author = PostAuthorSerializer(
        read_only=True
    )

    image = MediaURLField(required=False, allow_null=True)
    video = MediaURLField(required=False, allow_null=True)
    media_assets = MediaAssetSerializer(many=True, read_only=True)
    media_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        allow_empty=True,
        max_length=10,
        write_only=True,
    )

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
            "post_type",
            "image",
            "video",
            "media_assets",
            "media_ids",
            "visibility",
            "hashtags",
            "hashtag_list",
            "comments_count",
            "reactions_count",
            "my_reaction",
            "moderation_status",
            "boosted_until",
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
            "moderation_status",
            "boosted_until",
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
            self.instance.content if self.instance else "",
        ).strip()
        image = attrs.get(
            "image",
            self.instance.image if self.instance else None,
        )
        video = attrs.get(
            "video",
            self.instance.video if self.instance else None,
        )
        media_ids = attrs.get("media_ids")
        if media_ids is not None:
            if len(media_ids) != len(set(media_ids)):
                raise serializers.ValidationError(
                    {"media_ids": "Do not include duplicate media IDs."}
                )
            request = self.context.get("request")
            owner = request.user if request else None
            assets = list(
                MediaAsset.objects.filter(owner=owner, pk__in=media_ids)
            )
            if len(assets) != len(media_ids):
                raise serializers.ValidationError(
                    {"media_ids": "One or more media assets are invalid."}
                )
            if any(
                asset.processing_status == MediaAsset.ProcessingStatus.FAILED
                for asset in assets
            ):
                raise serializers.ValidationError(
                    {"media_ids": "Failed media assets cannot be attached."}
                )
            self._requested_media_assets = assets
        elif self.instance:
            assets = list(self.instance.media_assets.all())
        else:
            assets = []

        if not content and not image and not video and not assets:
            raise serializers.ValidationError(
                "A post must contain text or media."
            )
        if image and video:
            raise serializers.ValidationError("Add an image or a video, not both.")
        post_type = attrs.get(
            "post_type",
            self.instance.post_type if self.instance else Post.PostType.POST,
        )
        has_video_asset = any(
            asset.media_type == MediaAsset.MediaType.VIDEO for asset in assets
        )
        if post_type == Post.PostType.REEL and not video and not has_video_asset:
            raise serializers.ValidationError(
                {"video": "A reel must include a video."}
            )

        attrs["content"] = content

        return attrs

    def create(self, validated_data):
        validated_data.pop("hashtags", None)
        media_ids = validated_data.pop("media_ids", None)
        validated_data["moderation_status"] = self.get_moderation_status(
            validated_data.get("content", "")
        )
        post = super().create(validated_data)
        if media_ids is not None:
            post.media_assets.set(self._requested_media_assets)

        sync_post_hashtags(post)
        invalidate_feed(post.author_id)

        return post

    def update(self, instance, validated_data):
        validated_data.pop("hashtags", None)
        media_ids = validated_data.pop("media_ids", None)
        validated_data["moderation_status"] = self.get_moderation_status(
            validated_data.get("content", instance.content)
        )
        post = super().update(instance, validated_data)
        if media_ids is not None:
            post.media_assets.set(self._requested_media_assets)

        sync_post_hashtags(post)
        invalidate_feed(post.author_id)

        return post

    @classmethod
    def get_moderation_status(cls, content):
        normalized = (content or "").casefold()
        has_rice_topic = any(
            term in normalized
            if any(ord(char) > 127 for char in term)
            else re.search(rf"\b{re.escape(term)}\b", normalized)
            for term in cls.RICE_CONTENT_TERMS
        )
        return (
            Post.ModerationStatus.APPROVED
            if has_rice_topic
            else Post.ModerationStatus.PENDING
        )


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