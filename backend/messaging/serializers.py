from django.contrib.auth import get_user_model
from pathlib import PurePath
from rest_framework import serializers

from users.models import UserPrivacySettings
from users.presence import is_user_online

from .models import Conversation, Message


User = get_user_model()


class MessageSenderSerializer(
    serializers.ModelSerializer
):

    profile_picture = serializers.SerializerMethodField()
    is_verified = serializers.BooleanField(read_only=True)
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
            "is_verified",
            "is_online",
            "last_seen",
        ]

    def get_is_online(self, obj):
        if not self._privacy_setting(obj, "show_activity_status"):
            return None
        return is_user_online(obj)

    def get_last_seen(self, obj):
        if not self._privacy_setting(obj, "show_last_seen"):
            return None
        return obj.last_seen

    @staticmethod
    def _privacy_setting(user, field):
        try:
            return getattr(user.privacy_settings, field)
        except UserPrivacySettings.DoesNotExist:
            return True

    def get_profile_picture(self, obj):

        request = self.context.get("request")

        if not obj.profile_picture:
            return None

        url = obj.profile_picture.url

        if request:
            return request.build_absolute_uri(url)

        return url


class MessageSerializer(
    serializers.ModelSerializer
):

    sender = MessageSenderSerializer(
        read_only=True
    )
    conversation = serializers.PrimaryKeyRelatedField(
        read_only=True
    )
    content = serializers.CharField(required=False, allow_blank=True)
    attachment = serializers.FileField(required=False, allow_null=True)
    verification_warning = serializers.SerializerMethodField()
    reply_to = serializers.SerializerMethodField()
    reply_to_id = serializers.PrimaryKeyRelatedField(
        source="reply_to",
        queryset=Message.objects.all(),
        required=False,
        allow_null=True,
        write_only=True,
    )

    class Meta:
        model = Message

        fields = [
            "id",
            "conversation",
            "sender",
            "content",
            "attachment",
            "attachment_type",
            "verification_warning",
            "is_read",
            "is_deleted",
            "edited_at",
            "reply_to",
            "reply_to_id",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "conversation",
            "sender",
            "is_read",
            "is_deleted",
            "edited_at",
            "created_at",
            "updated_at",
        ]

    def validate_attachment(self, value):
        if value and value.size > 10 * 1024 * 1024:
            raise serializers.ValidationError("Attachments must be 10 MB or smaller.")
        return value

    def get_verification_warning(self, obj):
        return not obj.sender.is_verified

    def get_reply_to(self, obj):
        if not obj.reply_to_id:
            return None
        return {
            "id": obj.reply_to_id,
            "content": (
                "This message was deleted."
                if obj.reply_to.is_deleted
                else obj.reply_to.content
            ),
            "sender_id": obj.reply_to.sender_id,
        }

    def validate_reply_to(self, value):
        if self.instance is None and value:
            conversation_id = self.context.get("conversation_id")
            if conversation_id and value.conversation_id != conversation_id:
                raise serializers.ValidationError(
                    "Reply target must belong to this conversation."
                )
        return value

    def validate(self, attrs):

        content = attrs.get(
            "content",
            ""
        )

        # Make sure content is a string
        if content is None:
            content = ""

        content = content.strip()

        attachment = attrs.get(
            "attachment"
        )
        attachment_type = attrs.get(
            "attachment_type",
            Message.AttachmentType.FILE,
        )
        if attachment and attachment_type == Message.AttachmentType.AUDIO:
            allowed_extensions = {".m4a", ".mp3", ".ogg", ".wav", ".webm"}
            extension = PurePath(attachment.name).suffix.lower()
            content_type = getattr(attachment, "content_type", "") or ""
            if extension not in allowed_extensions or not content_type.startswith("audio/"):
                raise serializers.ValidationError(
                    {"attachment": "Voice notes must be a supported audio file."}
                )
        elif attachment and attachment_type in {
            Message.AttachmentType.IMAGE,
            Message.AttachmentType.VIDEO,
        }:
            allowed_media = {
                Message.AttachmentType.IMAGE: {
                    ".jpg": "image/jpeg",
                    ".jpeg": "image/jpeg",
                    ".png": "image/png",
                    ".webp": "image/webp",
                },
                Message.AttachmentType.VIDEO: {
                    ".mp4": "video/mp4",
                    ".webm": "video/webm",
                    ".mov": "video/quicktime",
                },
            }
            extension = PurePath(attachment.name).suffix.lower()
            content_type = getattr(attachment, "content_type", "") or ""
            if allowed_media[attachment_type].get(extension) != content_type:
                raise serializers.ValidationError(
                    {"attachment": "Choose a supported image or video file."}
                )
        reply_to = attrs.get("reply_to")
        conversation_id = self.context.get("conversation_id")
        if (
            reply_to
            and conversation_id
            and reply_to.conversation_id != conversation_id
        ):
            raise serializers.ValidationError(
                {"reply_to_id": "Reply target must belong to this conversation."}
            )

        # Message must have text or attachment
        if not content and not attachment and not self.instance:
            raise serializers.ValidationError(
                "A message must contain text or an attachment."
            )

        # Maximum message length
        if len(content) > 5000:
            raise serializers.ValidationError(
                "Message cannot exceed 5000 characters."
            )

        attrs["content"] = content

        return attrs


class ConversationSerializer(
    serializers.ModelSerializer
):

    participants = MessageSenderSerializer(
        many=True,
        read_only=True
    )

    last_message = serializers.SerializerMethodField()

    unread_count = serializers.SerializerMethodField()
    is_group = serializers.SerializerMethodField()

    class Meta:
        model = Conversation

        fields = [
            "id",
            "conversation_type",
            "name",
            "is_group",
            "participants",
            "last_message",
            "unread_count",
            "created_at",
            "updated_at",
        ]

    def get_is_group(self, obj):
        return obj.conversation_type == Conversation.ConversationType.GROUP

    def get_last_message(self, obj):

        message = (
            obj.messages
            .select_related("sender")
            .order_by("-created_at")
            .first()
        )

        if not message:
            return None

        return MessageSerializer(
            message,
            context=self.context
        ).data

    def get_unread_count(self, obj):

        request = self.context.get("request")

        if not request:
            return 0

        return (
            obj.messages
            .filter(
                is_read=False
            )
            .exclude(
                sender=request.user
            )
            .count()
        )