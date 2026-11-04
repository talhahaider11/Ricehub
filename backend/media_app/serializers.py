from rest_framework import serializers

from .models import MediaAsset


def _absolute_url(file_field, request):
    if not file_field:
        return None

    url = file_field.url
    if url.startswith(("http://", "https://", "//")):
        return url
    return request.build_absolute_uri(url) if request else url


class MediaAssetSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = MediaAsset
        fields = [
            "id",
            "media_type",
            "url",
            "thumbnail_url",
            "original_filename",
            "mime_type",
            "file_size",
            "width",
            "height",
            "duration_seconds",
            "processing_status",
            "created_at",
        ]
        read_only_fields = fields

    def get_url(self, obj):
        return _absolute_url(obj.playable_file, self.context.get("request"))

    def get_thumbnail_url(self, obj):
        return _absolute_url(obj.thumbnail, self.context.get("request"))


class MediaUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    media_type = serializers.ChoiceField(choices=MediaAsset.MediaType.choices)
