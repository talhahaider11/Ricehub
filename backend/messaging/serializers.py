from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Conversation, Message


User = get_user_model()


class MessageSenderSerializer(
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


class MessageSerializer(
    serializers.ModelSerializer
):

    sender = MessageSenderSerializer(
        read_only=True
    )
    conversation = serializers.PrimaryKeyRelatedField(
        read_only=True
    )
    attachment = serializers.SerializerMethodField()

    class Meta:
        model = Message

        fields = [
            "id",
            "conversation",
            "sender",
            "content",
            "attachment",
            "is_read",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "conversation",
            "sender",
            "is_read",
            "created_at",
        ]

    def get_attachment(self, obj):

        request = self.context.get("request")

        if not obj.attachment:
            return None

        url = obj.attachment.url

        if request:
            return request.build_absolute_uri(url)

        return url

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

        # Message must have text or attachment
        if not content and not attachment:
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

    class Meta:
        model = Conversation

        fields = [
            "id",
            "participants",
            "last_message",
            "unread_count",
            "created_at",
            "updated_at",
        ]

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