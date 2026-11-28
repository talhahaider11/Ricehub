import json
import logging
from datetime import timedelta

from asgiref.sync import async_to_sync
from channels.exceptions import ChannelFull
from channels.layers import get_channel_layer
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, OuterRef, Prefetch, Subquery
from django.db.models.functions import Substr
from django.utils import timezone

from rest_framework import generics, status
from config.permissions import IsActiveAndNotSuspended as IsAuthenticated
from config.throttling import MessageRateThrottle
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.utils.encoders import JSONEncoder
from rest_framework.response import Response
from rest_framework.views import APIView
from redis.exceptions import RedisError

from .models import (
    CallInvitation,
    Conversation,
    ConversationMember,
    Message,
)
from .serializers import (
    ConversationSerializer,
    MessageSerializer,
    MessageSenderSerializer,
)
from .services import (
    ensure_conversation_memberships,
    get_or_create_conversation,
    notify_new_message,
    restore_conversation_memberships,
)
from .consumers import relay_call_signal
from .permissions import is_conversation_member
from users.privacy import (
    can_message_between,
    get_blocked_user_ids,
)
from friendships.services import get_friend_ids
from search.services import search_users


User = get_user_model()
logger = logging.getLogger(__name__)


def conversation_queryset(user, archived):
    latest_message = Message.objects.filter(
        conversation_id=OuterRef("pk"),
    ).order_by("-created_at", "-pk")
    unread_count = (
        Message.objects
        .filter(
            conversation_id=OuterRef("pk"),
            is_read=False,
        )
        .exclude(sender_id=user.pk)
        .order_by()
        .values("conversation_id")
        .annotate(total=Count("pk"))
        .values("total")[:1]
    )
    user_conversations = Conversation.objects.filter(participants=user)
    ensure_conversation_memberships(user_conversations, user)
    conversations = user_conversations.filter(
        memberships__user=user,
        memberships__is_archived=archived,
        memberships__deleted_at__isnull=True,
    )
    return (
        conversations
        .exclude(
            participants__id__in=get_blocked_user_ids(user)
        )
        .distinct()
        .annotate(
            unread_count_value=Subquery(unread_count),
            member_count_value=Count("participants", distinct=True),
            last_message_id=Subquery(latest_message.values("pk")[:1]),
            last_message_content=Subquery(
                latest_message
                .annotate(content_preview=Substr("content", 1, 161))
                .values("content_preview")[:1]
            ),
            last_message_sender_id=Subquery(latest_message.values("sender_id")[:1]),
            last_message_attachment_type=Subquery(
                latest_message.values("attachment_type")[:1]
            ),
            last_message_has_attachment=Subquery(
                latest_message.values("attachment")[:1]
            ),
            last_message_is_deleted=Subquery(
                latest_message.values("is_deleted")[:1]
            ),
            last_message_created_at=Subquery(
                latest_message.values("created_at")[:1]
            ),
            last_message_type=Subquery(
                latest_message.values("message_type")[:1]
            ),
        )
        .prefetch_related(
            Prefetch(
                "participants",
                queryset=User.objects.prefetch_related("privacy_settings"),
            ),
            Prefetch(
                "memberships",
                queryset=ConversationMember.objects.select_related("user")
                .prefetch_related("user__privacy_settings"),
            ),
        )
        .order_by("-updated_at")
    )


class MessageHistoryPagination(PageNumberPagination):
    page_size = 30
    page_size_query_param = "page_size"
    max_page_size = 30


class CallSignalFallbackView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        error = async_to_sync(relay_call_signal)(request.user, request.data)
        if error:
            if (
                error == "Call signal could not be delivered."
                and request.data.get("signal_type") == "offer"
            ):
                return Response(
                    {"detail": "Call queued for incoming-call polling."},
                    status=status.HTTP_202_ACCEPTED,
                )
            response_status = (
                status.HTTP_503_SERVICE_UNAVAILABLE
                if error == "Call signal could not be delivered."
                else status.HTTP_400_BAD_REQUEST
            )
            return Response({"detail": error}, status=response_status)
        return Response({"detail": "Call signal delivered."})


class CallInitiateView(CallSignalFallbackView):
    def post(self, request):
        if request.data.get("signal_type") != "offer":
            return Response(
                {"detail": "Call initiation requires an offer."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().post(request)


class IncomingCallsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        recent_cutoff = timezone.now() - timedelta(seconds=30)
        invitations = (
            CallInvitation.objects
            .filter(
                recipient=request.user,
                state=CallInvitation.State.RINGING,
                created_at__gte=recent_cutoff,
            )
            .select_related("caller")
            .order_by("created_at")
        )
        return Response([
            {
                "type": "incoming_call",
                "from_user_id": invitation.caller_id,
                "caller_id": invitation.caller_id,
                "caller_name": (
                    invitation.caller.get_full_name()
                    or invitation.caller.username
                ),
                "caller_avatar": (
                    invitation.caller.profile_picture.url
                    if invitation.caller.profile_picture
                    else None
                ),
                "conversation_id": invitation.conversation_id,
                "call_id": str(invitation.call_id),
                "call_type": "audio",
                "signal_type": "offer",
                "signal": invitation.offer,
            }
            for invitation in invitations
        ])


def get_active_group_conversation(conversation_id, user, *, lock=False):
    conversations = Conversation.objects.filter(
        pk=conversation_id,
        conversation_type=Conversation.ConversationType.GROUP,
        participants=user,
    )
    if lock:
        conversations = conversations.select_for_update()
    conversation = conversations.first()
    if not conversation:
        raise PermissionDenied("You cannot manage this group conversation.")
    membership = ConversationMember.objects.filter(
        conversation=conversation,
        user=user,
        deleted_at__isnull=True,
    ).first()
    if not membership:
        raise PermissionDenied("You are not an active member of this group.")
    return conversation, membership


def sync_community_membership(conversation, user, role=None, *, remove=False):
    community = getattr(conversation, "community", None)
    if not community:
        return
    from community.models import CommunityMembership

    if remove:
        if community.owner_id != user.pk:
            CommunityMembership.objects.filter(
                community=community,
                user=user,
            ).delete()
        return

    role = role or ConversationMember.Role.MEMBER
    community_role = (
        CommunityMembership.Role.ADMIN
        if role == ConversationMember.Role.ADMIN
        else CommunityMembership.Role.MEMBER
    )
    membership, created = CommunityMembership.objects.get_or_create(
        community=community,
        user=user,
        defaults={"role": community_role},
    )
    if (
        not created
        and community.owner_id != user.pk
        and membership.role != community_role
    ):
        membership.role = community_role
        membership.save(update_fields=["role"])


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
        event_payload = json.loads(json.dumps(payload, cls=JSONEncoder))
        async_to_sync(channel_layer.group_send)(
            f"chat_{conversation_id}",
            {
                "type": event_type,
                **event_payload,
            },
        )
    except (TypeError, ValueError):
        logger.exception(
            "Message event %s for conversation %s contained unsupported data.",
            event_type,
            conversation_id,
        )
    except (ChannelFull, RedisError, OSError, TimeoutError):
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
        archived = self.request.query_params.get("archived", "").lower() in {
            "1",
            "true",
            "yes",
        }
        return conversation_queryset(self.request.user, archived)

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

        ensure_conversation_memberships(
            Conversation.objects.filter(pk=conversation.pk),
            request.user,
        )
        ConversationMember.objects.filter(
            conversation=conversation,
            user=request.user,
        ).update(is_archived=False, deleted_at=None)

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
        if not request.user.is_verified:
            raise ValidationError(
                {"detail": "Only verified users can create group conversations."}
            )

        name = request.data.get("name")
        user_ids = request.data.get("user_ids")
        if not isinstance(name, str) or not name.strip():
            raise ValidationError({"name": "Group name is required."})
        name = name.strip()
        if len(name) > 100:
            raise ValidationError({"name": "Group name cannot exceed 100 characters."})
        if not isinstance(user_ids, list) or not user_ids:
            raise ValidationError({"user_ids": "Select at least one group member."})
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

        members = list(
            User.objects.filter(
                pk__in=selected_ids,
                is_active=True,
                is_suspended=False,
            )
        )
        if len(members) != len(selected_ids):
            raise ValidationError({"user_ids": "One or more selected members are unavailable."})
        if any(not member.is_verified for member in members):
            raise ValidationError(
                {"user_ids": "Only verified users can be added to a group."}
            )
        blocked_ids = get_blocked_user_ids(request.user)
        if selected_ids.intersection(blocked_ids):
            raise ValidationError({"user_ids": "Blocked users cannot be added to a group."})

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


class GroupMemberSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if query:
            if query.isdecimal() and len(query) < 19:
                users = User.objects.filter(
                    pk=int(query),
                    is_active=True,
                    is_suspended=False,
                    is_verified=True,
                ).exclude(
                    pk=request.user.pk,
                ).exclude(
                    pk__in=get_blocked_user_ids(request.user),
                ).order_by("username")
            else:
                terms = query.split()
                users = search_users(request.user, terms[0]).filter(
                    is_verified=True,
                )
                for term in terms[1:]:
                    users = users.filter(
                        pk__in=search_users(
                            request.user,
                            term,
                        ).values("pk")
                    )
                users = users.distinct().order_by("username")
        else:
            users = User.objects.filter(
                pk__in=get_friend_ids(request.user),
                is_active=True,
                is_suspended=False,
                is_verified=True,
            ).exclude(
                pk__in=get_blocked_user_ids(request.user),
            ).order_by("username")

        results = MessageSenderSerializer(
            users[:25],
            many=True,
            context={"request": request},
        ).data
        return Response({"results": results})


class GroupConversationMemberAddView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [MessageRateThrottle]

    @transaction.atomic
    def post(self, request, conversation_id):
        conversation = (
            Conversation.objects.select_for_update()
            .filter(
                pk=conversation_id,
                conversation_type=Conversation.ConversationType.GROUP,
                participants=request.user,
            )
            .first()
        )
        if not conversation:
            raise PermissionDenied("You cannot add members to this conversation.")
        admin_membership = ConversationMember.objects.filter(
            conversation=conversation,
            user=request.user,
            deleted_at__isnull=True,
        ).first()
        if not admin_membership or admin_membership.role != ConversationMember.Role.ADMIN:
            raise PermissionDenied("Only group admins can add members.")

        user_id = request.data.get("user_id")
        if not isinstance(user_id, int) or isinstance(user_id, bool):
            raise ValidationError({"user_id": "Enter a valid user ID."})

        if conversation.participants.filter(pk=user_id).exists():
            raise ValidationError({"user_id": "This user is already in the group."})
        if conversation.participants.count() >= 100:
            raise ValidationError({"user_id": "A group can have at most 100 members."})

        member = User.objects.filter(
            pk=user_id,
            is_active=True,
            is_suspended=False,
        ).first()
        if not member:
            raise ValidationError({"user_id": "User ID was not found or is unavailable."})
        if not member.is_verified:
            raise ValidationError(
                {"user_id": "Only verified users can be added to a group."}
            )
        if member.pk in get_blocked_user_ids(request.user):
            raise ValidationError({"user_id": "Blocked users cannot be added to a group."})

        conversation.participants.add(member)
        ConversationMember.objects.create(
            conversation=conversation,
            user=member,
        )
        sync_community_membership(conversation, member)
        conversation.save()

        return Response(
            ConversationSerializer(
                conversation,
                context={"request": request},
            ).data,
            status=status.HTTP_200_OK,
        )


class GroupConversationMemberManageView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def patch(self, request, conversation_id, user_id):
        conversation, _ = get_active_group_conversation(
            conversation_id,
            request.user,
            lock=True,
        )
        admin_membership = ConversationMember.objects.filter(
            conversation=conversation,
            user=request.user,
            deleted_at__isnull=True,
        ).first()
        if admin_membership.role != ConversationMember.Role.ADMIN:
            raise PermissionDenied("Only group admins can manage members.")

        role = request.data.get("role")
        if not isinstance(role, str) or role not in {
            ConversationMember.Role.ADMIN,
            ConversationMember.Role.MEMBER,
        }:
            raise ValidationError({"role": "Choose admin or member."})

        target = ConversationMember.objects.select_for_update().filter(
            conversation=conversation,
            user_id=user_id,
        ).select_related("user").first()
        if not target:
            return Response(
                {"detail": "Group member not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        community = getattr(conversation, "community", None)
        if community and community.owner_id == target.user_id:
            raise ValidationError(
                {"user_id": "The community owner cannot be removed from its group."}
            )
        if (
            target.role == ConversationMember.Role.ADMIN
            and role == ConversationMember.Role.MEMBER
            and ConversationMember.objects.filter(
                conversation=conversation,
                role=ConversationMember.Role.ADMIN,
            ).count() <= 1
        ):
            raise ValidationError({"role": "A group must keep at least one admin."})

        community = getattr(conversation, "community", None)
        if (
            community
            and community.owner_id == target.user_id
            and role != ConversationMember.Role.ADMIN
        ):
            raise ValidationError({"role": "The community owner must remain an admin."})

        target.role = role
        target.save(update_fields=["role"])
        sync_community_membership(conversation, target.user, role)
        return Response(
            ConversationSerializer(
                conversation,
                context={"request": request},
            ).data
        )

    @transaction.atomic
    def delete(self, request, conversation_id, user_id):
        conversation, admin_membership = get_active_group_conversation(
            conversation_id,
            request.user,
            lock=True,
        )
        if admin_membership.role != ConversationMember.Role.ADMIN:
            raise PermissionDenied("Only group admins can remove members.")
        if user_id == request.user.pk:
            raise ValidationError(
                {"user_id": "Use the leave-group action to remove yourself."}
            )

        target = ConversationMember.objects.select_for_update().filter(
            conversation=conversation,
            user_id=user_id,
        ).select_related("user").first()
        if not target:
            return Response(
                {"detail": "Group member not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if (
            target.role == ConversationMember.Role.ADMIN
            and ConversationMember.objects.filter(
                conversation=conversation,
                role=ConversationMember.Role.ADMIN,
            ).count() <= 1
        ):
            raise ValidationError(
                {"user_id": "A group must keep at least one admin."}
            )

        removed_user = target.user
        removed_user_id = target.user_id
        conversation.participants.remove(removed_user)
        target.delete()
        sync_community_membership(conversation, removed_user, remove=True)
        transaction.on_commit(
            lambda: broadcast_message_event(
                conversation.pk,
                "conversation_hidden",
                {"user_id": removed_user_id},
            )
        )
        return Response(
            ConversationSerializer(
                conversation,
                context={"request": request},
            ).data
        )


class GroupConversationSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def patch(self, request, conversation_id):
        conversation, membership = get_active_group_conversation(
            conversation_id,
            request.user,
            lock=True,
        )
        if membership.role != ConversationMember.Role.ADMIN:
            raise PermissionDenied("Only group admins can change group settings.")
        admins_only = request.data.get("admins_only")
        if not isinstance(admins_only, bool):
            raise ValidationError({"admins_only": "Provide true or false."})
        conversation.admins_only = admins_only
        conversation.save(update_fields=["admins_only", "updated_at"])
        return Response(
            ConversationSerializer(
                conversation,
                context={"request": request},
            ).data
        )


class ConversationMuteView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, conversation_id):
        is_muted = request.data.get("is_muted")
        if not isinstance(is_muted, bool):
            raise ValidationError({"is_muted": "Provide true or false."})
        conversation = Conversation.objects.filter(
            pk=conversation_id,
            participants=request.user,
        ).first()
        if not conversation or not is_conversation_member(
            request.user,
            conversation_id,
        ):
            return Response(
                {"detail": "Conversation not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        membership, _ = ConversationMember.objects.get_or_create(
            conversation=conversation,
            user=request.user,
        )
        membership.is_muted = is_muted
        membership.save(update_fields=["is_muted"])
        return Response(
            ConversationSerializer(
                conversation,
                context={"request": request},
            ).data
        )


class GroupConversationLeaveView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def delete(self, request, conversation_id):
        conversation, membership = get_active_group_conversation(
            conversation_id,
            request.user,
            lock=True,
        )
        if (
            membership.role == ConversationMember.Role.ADMIN
            and ConversationMember.objects.filter(
                conversation=conversation,
                role=ConversationMember.Role.ADMIN,
            ).count() <= 1
        ):
            raise ValidationError(
                {"detail": "Promote another admin before leaving this group."}
            )
        conversation.participants.remove(request.user)
        membership.delete()
        sync_community_membership(conversation, request.user, remove=True)
        user_id = request.user.pk
        transaction.on_commit(
            lambda: broadcast_message_event(
                conversation.pk,
                "conversation_hidden",
                {"user_id": user_id},
            )
        )
        return Response({"success": True}, status=status.HTTP_200_OK)


class ConversationDetailView(
    generics.RetrieveAPIView
):

    permission_classes = [
        IsAuthenticated
    ]

    serializer_class = ConversationSerializer

    def get_queryset(self):
        return conversation_queryset(self.request.user, False)


class MessageListCreateView(
    generics.ListCreateAPIView
):

    permission_classes = [
        IsAuthenticated
    ]

    serializer_class = MessageSerializer
    pagination_class = MessageHistoryPagination

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

        messages = (
            Message.objects
            .filter(
                conversation_id=conversation_id
            )
            .select_related(
                "sender",
                "sender__privacy_settings",
                "conversation",
                "reply_to",
                "reply_to__sender",
            )
            .prefetch_related("conversation__participants")
            .order_by("-created_at", "-pk")
        )
        after_id = self.request.query_params.get("after_id")
        if after_id is not None:
            try:
                after_id = int(after_id)
            except (TypeError, ValueError) as error:
                raise ValidationError(
                    {"after_id": "A valid message ID is required."}
                ) from error
            if after_id <= 0:
                raise ValidationError(
                    {"after_id": "A valid message ID is required."}
                )
            messages = messages.filter(pk__gt=after_id)
        return messages

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
            raise PermissionDenied(
                "You are not part of this conversation."
            )
        if not is_conversation_member(self.request.user, conversation_id):
            raise PermissionDenied("This conversation is no longer available.")
        if conversation.conversation_type == Conversation.ConversationType.GROUP:
            membership = ConversationMember.objects.filter(
                conversation=conversation,
                user=self.request.user,
                deleted_at__isnull=True,
            ).first()
            if (
                conversation.admins_only
                and (
                    not membership
                    or membership.role != ConversationMember.Role.ADMIN
                )
            ):
                raise PermissionDenied("Only group admins can send messages.")
        other_user = (
            conversation.participants.exclude(pk=self.request.user.pk).first()
            if conversation.conversation_type == Conversation.ConversationType.DIRECT
            else None
        )
        if other_user and not can_message_between(self.request.user, other_user):
            raise PermissionDenied("This person is not accepting messages.")

        serializer.save(
            sender=self.request.user,
            conversation=conversation,
        )

        notify_new_message(
            conversation,
            self.request.user,
            serializer.instance,
        )
        restore_conversation_memberships(conversation)
        conversation.save()
        message_data = MessageSerializer(
            serializer.instance,
            context=self.get_serializer_context(),
        ).data
        broadcast_message_event(
            conversation.pk,
            "chat_message",
            {"message": message_data},
        )


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
        if not is_conversation_member(request.user, conversation_id):
            return Response(
                {"detail": "Conversation not found."},
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
        if (
            message.conversation.conversation_type
            == Conversation.ConversationType.GROUP
            and message.conversation.admins_only
        ):
            membership = ConversationMember.objects.filter(
                conversation=message.conversation,
                user=request.user,
                deleted_at__isnull=True,
            ).first()
            if not membership or membership.role != ConversationMember.Role.ADMIN:
                raise PermissionDenied("Only group admins can edit messages.")
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


class ConversationArchiveView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, conversation_id):
        is_archived = request.data.get("is_archived")
        if not isinstance(is_archived, bool):
            raise ValidationError(
                {"is_archived": "Provide true or false."}
            )
        conversation = Conversation.objects.filter(
            pk=conversation_id,
            participants=request.user,
        ).first()
        if not conversation or not is_conversation_member(
            request.user,
            conversation_id,
        ):
            return Response(
                {"detail": "Conversation not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        membership, _ = ConversationMember.objects.get_or_create(
            conversation=conversation,
            user=request.user,
        )
        membership.is_archived = is_archived
        membership.save(update_fields=["is_archived"])
        return Response(
            ConversationSerializer(
                conversation,
                context={"request": request},
            ).data
        )


class ConversationDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, conversation_id):
        conversation = Conversation.objects.filter(
            pk=conversation_id,
            participants=request.user,
        ).first()
        if not conversation or not is_conversation_member(
            request.user,
            conversation_id,
        ):
            return Response(
                {"detail": "Conversation not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        membership, _ = ConversationMember.objects.get_or_create(
            conversation=conversation,
            user=request.user,
        )
        membership.deleted_at = timezone.now()
        membership.save(update_fields=["deleted_at"])
        broadcast_message_event(
            conversation.pk,
            "conversation_hidden",
            {"user_id": request.user.pk},
        )
        return Response({"success": True}, status=status.HTTP_200_OK)