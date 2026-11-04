from rest_framework import serializers

from media_app.models import MediaAsset
from .models import Story


class StoryAuthorSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    username = serializers.CharField(read_only=True)
    first_name = serializers.CharField(read_only=True)
    last_name = serializers.CharField(read_only=True)
    profile_picture = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()

    def get_profile_picture(self, user):
        if not user.profile_picture:
            return None
        url = user.profile_picture.url
        request = self.context.get("request")
        return request.build_absolute_uri(url) if request else url

    def get_avatar(self, user):
        return self.get_profile_picture(user)


class StoryMediaField(serializers.FileField):
    def to_representation(self, value):
        if not value:
            return None
        url = value.url
        request = self.context.get("request")
        return request.build_absolute_uri(url) if request else url


class StorySerializer(serializers.ModelSerializer):
    author = StoryAuthorSerializer(read_only=True)
    media_id = serializers.PrimaryKeyRelatedField(
        source="media_asset",
        queryset=MediaAsset.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    caption = serializers.CharField(
        source="text",
        max_length=500,
        allow_blank=True,
        required=False,
    )
    text = serializers.CharField(read_only=True)
    image = StoryMediaField(read_only=True)
    video = StoryMediaField(read_only=True)
    media_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    media_type = serializers.SerializerMethodField()
    duration_seconds = serializers.SerializerMethodField()
    is_seen = serializers.BooleanField(source="seen_by_user", read_only=True)
    view_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Story
        fields = (
            "id",
            "author",
            "caption",
            "text",
            "image",
            "video",
            "media_id",
            "media_url",
            "thumbnail_url",
            "media_type",
            "duration_seconds",
            "visibility",
            "view_count",
            "is_seen",
            "created_at",
            "expires_at",
        )
        read_only_fields = (
            "id",
            "author",
            "media_url",
            "thumbnail_url",
            "media_type",
            "duration_seconds",
            "view_count",
            "is_seen",
            "created_at",
            "expires_at",
        )

    def to_internal_value(self, data):
        if "text" in data and "caption" not in data:
            data = data.copy()
            data["caption"] = data["text"]
        return super().to_internal_value(data)

    def validate(self, attrs):
        request = self.context.get("request")
        submitted_data = getattr(request, "data", {})
        if submitted_data.get("image") or submitted_data.get("video") or submitted_data.get("media"):
            raise serializers.ValidationError(
                "Upload story media through the media API first."
            )

        media_asset = attrs.get("media_asset")
        if media_asset:
            media_asset = (
                MediaAsset.objects
                .select_for_update()
                .filter(pk=media_asset.pk)
                .first()
            )
            if media_asset is None:
                raise serializers.ValidationError(
                    {"media_id": "This media is no longer available."}
                )
            attrs["media_asset"] = media_asset
            request = self.context["request"]
            if media_asset.owner_id != request.user.pk:
                raise serializers.ValidationError(
                    {"media_id": "You can only use media that you uploaded."}
                )
            if media_asset.processing_status != MediaAsset.ProcessingStatus.READY:
                raise serializers.ValidationError(
                    {"media_id": "Story media must finish processing first."}
                )
            if media_asset.media_type not in {
                MediaAsset.MediaType.IMAGE,
                MediaAsset.MediaType.VIDEO,
            }:
                raise serializers.ValidationError(
                    {"media_id": "This media type cannot be used in a story."}
                )
        if (
            not attrs.get("text", "").strip()
            and not media_asset
        ):
            raise serializers.ValidationError(
                "Add text or media to your story."
            )
        return attrs

    def create(self, validated_data):
        return Story.objects.create(
            author=self.context["request"].user,
            **validated_data,
        )

    def get_media_url(self, story):
        media_asset = story.media_asset
        if media_asset:
            media = media_asset.playable_file
        else:
            media = story.image or story.video or story.media
        if not media:
            return None
        url = media.url
        request = self.context.get("request")
        return request.build_absolute_uri(url) if request else url

    def get_thumbnail_url(self, story):
        if story.media_asset and story.media_asset.thumbnail:
            url = story.media_asset.thumbnail.url
            request = self.context.get("request")
            return request.build_absolute_uri(url) if request else url
        return self.get_media_url(story)

    def get_media_type(self, story):
        if story.media_asset:
            return story.media_asset.media_type
        if story.image:
            return "image"
        if story.video:
            return "video"
        if not story.media:
            return None
        name = story.media.name.lower()
        return "video" if name.endswith((".mp4", ".webm", ".mov")) else "image"

    def get_duration_seconds(self, story):
        return story.media_asset.duration_seconds if story.media_asset else None
