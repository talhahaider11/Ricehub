from django.contrib.auth import get_user_model

from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Conversation, Message
from .serializers import (
    ConversationSerializer,
    MessageSerializer,
)
from .services import get_or_create_conversation
from users.privacy import can_message_between, get_blocked_user_ids


User = get_user_model()


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

    def get_queryset(self):
        conversation = (
            Conversation.objects
            .filter(
                id=self.kwargs["conversation_id"],
                participants=self.request.user,
            )
            .prefetch_related("participants")
            .first()
        )
        if not conversation:
            return Message.objects.none()
        other_user = conversation.participants.exclude(
            pk=self.request.user.pk
        ).first()
        if other_user and not can_message_between(self.request.user, other_user):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("This conversation is no longer available.")
        conversation_id = (
            self.kwargs["conversation_id"]
        )

        return (
            Message.objects
            .filter(
                conversation_id=conversation_id
            )
            .select_related(
                "sender"
            )
            .order_by("created_at")
        )

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
        other_user = conversation.participants.exclude(
            pk=self.request.user.pk
        ).first()
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
        other_user = conversation.participants.exclude(
            pk=request.user.pk
        ).first()
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

        return Response(
            {
                "message": "Messages marked as read.",
                "read_receipts_enabled": True,
                "message_ids": message_ids,
            }
        )