import logging

from asgiref.sync import async_to_sync
from channels.exceptions import ChannelFull
from channels.layers import get_channel_layer
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from rest_framework import generics, status
from config.permissions import IsActiveAndNotSuspended as IsAuthenticated
from config.throttling import MessageRateThrottle
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from redis.exceptions import RedisError

from .models import (
    Conversation,
    ConversationMember,
    Message,
)
from .serializers import (
    ConversationSerializer,
    MessageSerializer,
)
from .services import get_or_create_conversation
from .permissions import is_conversation_member
from friendships.services import get_friend_ids
from users.privacy import (
    can_message_between,
    get_blocked_user_ids,
)


User = get_user_model()
logger = logging.getLogger(__name__)


def broadcast_message_event(conversation_id, event_type, payload):
    channel_layer = get_channel_layer()
    if not channel_layer:
        logger.error(
            "Message event %s for conversation %s could not be broadcast: "
            "no channel layer is configured.",
            event_type,
            conversation_id,
        )
        return
    try:
        async_to_sync(channel_layer.group_send)(
            f"chat_{conversation_id}",
            {
                "type": event_type,
                **payload,
            },
        )
    except (ChannelFull, RedisError):
        logger.exception(
            "Message event %s for conversation %s could not be broadcast.",
            event_type,
            conversation_id,
        )


class ConversationListCreateView(
    generics.ListCreateAPIView
):

    permission_classes = [
        IsAuthenticated
    ]

    serializer_class = ConversationSerializer

    def get_queryset(self):

        return (
            Conversation.objects
            .filter(
                participants=self.request.user
            )
            .exclude(
                participants__id__in=get_blocked_user_ids(self.request.user)
            )
            .distinct()
            .prefetch_related(
                "participants"
            )
            .order_by("-updated_at")
        )

    def create(self, request, *args, **kwargs):

        username = request.data.get(
            "username"
        )

        if not username:
            return Response(
                {
                    "detail": "Username is required."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            other_user = User.objects.get(
                username=username
            )
        except User.DoesNotExist:
            return Response(
                {
                    "detail": "User not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        if not can_message_between(request.user, other_user):
            return Response(
                {"detail": "This person is not accepting messages from you."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            conversation, created = (
                get_or_create_conversation(
                    request.user,
                    other_user,
                )
            )
        except ValueError as error:
            return Response(
                {
                    "detail": str(error)
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(
            conversation
        )

        return Response(
            serializer.data,
            status=(
                status.HTTP_201_CREATED
                if created
                else status.HTTP_200_OK
            ),
        )


class GroupConversationCreateView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [MessageRateThrottle]

    @transaction.atomic
    def post(self, request):
        name = request.data.get("name")
        user_ids = request.data.get("user_ids")
        if not isinstance(name, str) or not name.strip():
            raise ValidationError({"name": "Group name is required."})
        name = name.strip()
        if len(name) > 100:
            raise ValidationError({"name": "Group name cannot exceed 100 characters."})
        if not isinstance(user_ids, list) or not user_ids:
            raise ValidationError({"user_ids": "Select at least one friend."})
        if not all(
            isinstance(user_id, int) and not isinstance(user_id, bool)
            for user_id in user_ids
        ):
            raise ValidationError({"user_ids": "Member IDs must be integers."})
        if len(user_ids) != len(set(user_ids)):
            raise ValidationError({"user_ids": "Duplicate members are not allowed."})
        if len(user_ids) > 99:
            raise ValidationError({"user_ids": "A group can have at most 100 members."})

        selected_ids = set(user_ids)
        if request.user.pk in selected_ids:
            raise ValidationError({"user_ids": "You are already included in the group."})
        if not selected_ids.issubset(set(get_friend_ids(request.user))):
            raise ValidationError({"user_ids": "All group members must be your friends."})

        members = list(
            User.objects.filter(
                pk__in=selected_ids,
                is_active=True,
                is_suspended=False,
            )
        )
        if len(members) != len(selected_ids):
            raise ValidationError({"user_ids": "One or more selected members are unavailable."})
        if any(not can_message_between(request.user, member) for member in members):
            raise ValidationError(
                {"user_ids": "A selected member is not accepting messages."}
            )

        conversation = Conversation.objects.create(
            conversation_type=Conversation.ConversationType.GROUP,
            name=name,
            created_by=request.user,
        )
        conversation.participants.add(request.user, *members)
        ConversationMember.objects.bulk_create(
            [
                ConversationMember(
                    conversation=conversation,
                    user=member,
                    role=(
                        ConversationMember.Role.ADMIN
                        if member.pk == request.user.pk
                        else ConversationMember.Role.MEMBER
                    ),
                )
                for member in [request.user, *members]
            ]
        )
        return Response(
            ConversationSerializer(
                conversation,
                context={"request": request},
            ).data,
            status=status.HTTP_201_CREATED,
        )


class ConversationDetailView(
    generics.RetrieveAPIView
):

    permission_classes = [
        IsAuthenticated
    ]

    serializer_class = ConversationSerializer

    def get_queryset(self):

        return (
            Conversation.objects
            .filter(
                participants=self.request.user
            )
            .exclude(
                participants__id__in=get_blocked_user_ids(self.request.user)
            )
            .distinct()
            .prefetch_related(
                "participants"
            )
        )


class MessageListCreateView(
    generics.ListCreateAPIView
):

    permission_classes = [
        IsAuthenticated
    ]

    serializer_class = MessageSerializer

    def get_throttles(self):
        throttles = super().get_throttles()
        if self.request.method == "POST":
            return [MessageRateThrottle(), *throttles]
        return throttles

    def get_queryset(self):
        conversation_id = self.kwargs["conversation_id"]
        if not is_conversation_member(self.request.user, conversation_id):
            return Message.objects.none()
        conversation = (
            Conversation.objects
            .filter(
                id=conversation_id,
                participants=self.request.user,
            )
            .prefetch_related("participants")
            .first()
        )
        if not conversation:
            return Message.objects.none()
        other_users = conversation.participants.exclude(pk=self.request.user.pk)
        if conversation.conversation_type == Conversation.ConversationType.DIRECT:
            other_user = other_users.first()
        else:
            other_user = None
        if other_user and not can_message_between(self.request.user, other_user):
            raise PermissionDenied("This conversation is no longer available.")

        return (
            Message.objects
            .filter(
                conversation_id=conversation_id
            )
            .select_related(
                "sender",
                "conversation",
                "reply_to",
            )
            .prefetch_related("conversation__participants")
            .order_by("created_at")
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["conversation_id"] = self.kwargs["conversation_id"]
        return context

    def perform_create(self, serializer):

        conversation_id = (
            self.kwargs["conversation_id"]
        )

        conversation = (
            Conversation.objects
            .filter(
                id=conversation_id,
                participants=self.request.user,
            )
            .first()
        )

        if not conversation:
            from rest_framework.exceptions import (
                PermissionDenied
            )

            raise PermissionDenied(
                "You are not part of this conversation."
            )
        other_user = (
            conversation.participants.exclude(pk=self.request.user.pk).first()
            if conversation.conversation_type == Conversation.ConversationType.DIRECT
            else None
        )
        if other_user and not can_message_between(self.request.user, other_user):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("This person is not accepting messages.")

        serializer.save(
            sender=self.request.user,
            conversation=conversation,
        )

        conversation.save()


class MarkConversationReadView(APIView):

    permission_classes = [
        IsAuthenticated
    ]

    def post(self, request, conversation_id):

        conversation = (
            Conversation.objects
            .filter(
                id=conversation_id,
                participants=request.user,
            )
            .first()
        )

        if not conversation:
            return Response(
                {
                    "detail": "Conversation not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        other_user = (
            conversation.participants.exclude(pk=request.user.pk).first()
            if conversation.conversation_type == Conversation.ConversationType.DIRECT
            else None
        )
        if other_user and not can_message_between(request.user, other_user):
            return Response(
                {"detail": "This conversation is no longer available."},
                status=status.HTTP_403_FORBIDDEN,
            )
        privacy_settings = getattr(request.user, "privacy_settings", None)
        if privacy_settings and not privacy_settings.read_receipts:
            return Response({
                "message": "Read receipts are turned off.",
                "read_receipts_enabled": False,
                "message_ids": [],
            })

        unread_messages = conversation.messages.filter(
            is_read=False
        ).exclude(sender=request.user)
        message_ids = list(unread_messages.values_list("id", flat=True))
        unread_messages.update(is_read=True)
        ConversationMember.objects.update_or_create(
            conversation=conversation,
            user=request.user,
            defaults={"last_read_at": timezone.now()},
        )

        return Response(
            {
                "message": "Messages marked as read.",
                "read_receipts_enabled": True,
                "message_ids": message_ids,
            }
        )


class EditMessageView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [MessageRateThrottle]

    def patch(self, request, message_id):
        message = Message.objects.filter(
            pk=message_id,
            sender=request.user,
        ).select_related("conversation", "reply_to").first()
        if not message or not is_conversation_member(
            request.user,
            message.conversation_id,
        ):
            return Response(
                {"detail": "Message not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if message.is_deleted:
            return Response(
                {"detail": "Deleted messages cannot be edited."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        content = request.data.get("content")
        if not isinstance(content, str) or not content.strip():
            return Response(
                {"detail": "Message cannot be empty."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        content = content.strip()
        if len(content) > 5000:
            return Response(
                {"detail": "Message is too long."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        message.content = content
        message.edited_at = timezone.now()
        message.save(update_fields=["content", "edited_at", "updated_at"])
        message_data = MessageSerializer(
            message,
            context={"request": request},
        ).data
        broadcast_message_event(
            message.conversation_id,
            "message_updated",
            {"message": message_data},
        )
        return Response(
            message_data
        )


class DeleteMessageView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [MessageRateThrottle]

    def delete(self, request, message_id):
        message = Message.objects.filter(
            pk=message_id,
            sender=request.user,
        ).select_related("conversation").first()
        if not message or not is_conversation_member(
            request.user,
            message.conversation_id,
        ):
            return Response(
                {"detail": "Message not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if not message.is_deleted:
            if message.attachment:
                message.attachment.delete(save=False)
            message.content = ""
            message.attachment = None
            message.is_deleted = True
            message.save(
                update_fields=[
                    "content",
                    "attachment",
                    "is_deleted",
                    "updated_at",
                ]
            )
            broadcast_message_event(
                message.conversation_id,
                "message_deleted",
                {"message_id": message.pk},
            )
        return Response({"success": True}, status=status.HTTP_200_OK)