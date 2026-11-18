import json
import logging
import uuid

from channels.db import database_sync_to_async
from channels.exceptions import ChannelFull
from channels.layers import get_channel_layer
from channels.generic.websocket import AsyncJsonWebsocketConsumer, AsyncWebsocketConsumer
from redis.exceptions import RedisError

from django.contrib.auth import get_user_model
from django.utils import timezone

from .models import Conversation, ConversationMember, Message
from .services import restore_conversation_memberships
from users.privacy import can_message_between


User = get_user_model()
logger = logging.getLogger(__name__)
CALL_SIGNAL_TYPES = {"offer", "answer", "ice_candidate", "reject", "hangup"}
CALL_LOG_STATUSES = {
    Message.CallStatus.COMPLETED,
    Message.CallStatus.CANCELLED,
    Message.CallStatus.MISSED,
    Message.CallStatus.UNANSWERED,
}


@database_sync_to_async
def is_valid_call_peer(user_id, conversation_id, target_user_id):
    conversation = (
        Conversation.objects
        .filter(
            id=conversation_id,
            conversation_type=Conversation.ConversationType.DIRECT,
            participants__id=user_id,
        )
        .prefetch_related("participants")
        .first()
    )
    if not conversation:
        return False
    membership = ConversationMember.objects.filter(
        conversation=conversation,
        user_id=user_id,
    ).first()
    if membership and membership.deleted_at:
        return False
    other_user = conversation.participants.exclude(pk=user_id).first()
    return bool(
        other_user
        and other_user.pk == target_user_id
        and can_message_between(User.objects.get(pk=user_id), other_user)
    )


@database_sync_to_async
def get_call_user_details(user):
    avatar = user.profile_picture.url if user.profile_picture else None
    return {
        "caller_name": user.get_full_name() or user.username,
        "caller_avatar": avatar,
    }


@database_sync_to_async
def save_call_ended_message(
    user,
    conversation_id,
    call_id,
    status,
    caller_id,
    duration_seconds,
):
    if status not in CALL_LOG_STATUSES:
        return None, False
    conversation = (
        Conversation.objects
        .filter(
            id=conversation_id,
            conversation_type=Conversation.ConversationType.DIRECT,
            participants__id__in=[user.pk, caller_id],
        )
        .distinct()
        .first()
    )
    if (
        not conversation
        or not conversation.participants.filter(pk=user.pk).exists()
        or not conversation.participants.filter(pk=caller_id).exists()
    ):
        return None, False

    membership = ConversationMember.objects.filter(
        conversation=conversation,
        user=user,
    ).first()
    if membership and membership.deleted_at:
        return None, False

    message, created = Message.objects.get_or_create(
        call_id=call_id,
        defaults={
            "conversation": conversation,
            "sender_id": caller_id,
            "content": "",
            "message_type": Message.MessageType.CALL_LOG,
            "call_status": status,
            "call_duration_seconds": duration_seconds,
        },
    )
    if message.conversation_id != conversation.id:
        return None, False

    if created:
        restore_conversation_memberships(conversation)
        conversation.save()

    return {
        "id": message.id,
        "conversation": message.conversation_id,
        "sender": message.sender_id,
        "reply_to": None,
        "reply_to_id": None,
        "sender_username": message.sender.username,
        "verification_warning": not message.sender.is_verified,
        "content": message.content,
        "message_type": message.message_type,
        "call_id": str(message.call_id),
        "call_status": message.call_status,
        "call_duration_seconds": message.call_duration_seconds,
        "created_at": message.created_at.isoformat(),
        "is_read": message.is_read,
    }, created


async def relay_call_signal(user, data):
    if not isinstance(data, dict) or data.get("type") != "call_signal":
        return "Call signal is invalid."

    signal_type = data.get("signal_type")
    target_user_id = data.get("to_user_id")
    conversation_id = data.get("conversation_id")
    signal = data.get("signal", {})
    try:
        call_id = uuid.UUID(str(data.get("call_id")))
    except (ValueError, TypeError, AttributeError):
        call_id = None

    caller_id = data.get("caller_id", user.id)
    if (
        not isinstance(signal_type, str)
        or signal_type not in CALL_SIGNAL_TYPES
        or not isinstance(target_user_id, int)
        or isinstance(target_user_id, bool)
        or not isinstance(conversation_id, int)
        or isinstance(conversation_id, bool)
        or not isinstance(caller_id, int)
        or isinstance(caller_id, bool)
        or caller_id not in {user.id, target_user_id}
        or (signal_type == "offer" and caller_id != user.id)
        or not isinstance(signal, dict)
        or len(json.dumps(data)) > 20_000
        or call_id is None
    ):
        return "Call signal is invalid."

    if not await is_valid_call_peer(user.id, conversation_id, target_user_id):
        return "This conversation is not available for audio calls."

    if data.get("call_type", "audio") != "audio":
        return "Only audio calls are supported."
    description = signal.get("sdp", "")
    if isinstance(description, str) and "m=video" in description:
        return "Only audio calls are supported."

    sender = await get_call_user_details(user)
    call_status = data.get("status") or signal.get("status")
    if not isinstance(call_status, str) or call_status not in CALL_LOG_STATUSES:
        call_status = (
            Message.CallStatus.CANCELLED
            if signal_type in {"reject", "hangup"}
            else None
        )
    duration_seconds = data.get("duration_seconds")
    if (
        not isinstance(duration_seconds, int)
        or isinstance(duration_seconds, bool)
        or not 0 <= duration_seconds <= 86_400
    ):
        duration_seconds = None
    event = {
        "type": "call_signal_event",
        "from_user_id": user.id,
        "caller_id": caller_id,
        **sender,
        "conversation_id": conversation_id,
        "call_id": str(call_id),
        "call_type": "audio",
        "signal_type": signal_type,
        "signal": signal,
        "status": call_status,
    }

    channel_layer = get_channel_layer()
    if not channel_layer:
        logger.error("Call signal from user %s has no channel layer.", user.id)
        return "Call signal could not be delivered."
    try:
        await channel_layer.group_send(f"user_{target_user_id}", event)
    except (ChannelFull, RedisError, OSError, TimeoutError):
        logger.exception("Call signal from user %s could not be routed.", user.id)
        return "Call signal could not be delivered."

    if signal_type in {"reject", "hangup"}:
        message, created = await save_call_ended_message(
            user,
            conversation_id,
            call_id,
            call_status,
            caller_id,
            duration_seconds,
        )
        if message and created:
            try:
                await channel_layer.group_send(
                    f"chat_{conversation_id}",
                    {"type": "chat_message", "message": message},
                )
            except (ChannelFull, RedisError, OSError, TimeoutError):
                logger.exception(
                    "Call end message %s was saved but could not be broadcast.",
                    message["id"],
                )
    return None


class CallSignalingConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get("user")
        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        self.user_group_name = f"user_{self.user.id}"
        await self.channel_layer.group_add(
            self.user_group_name,
            self.channel_name,
        )
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "user_group_name"):
            await self.channel_layer.group_discard(
                self.user_group_name,
                self.channel_name,
            )

    async def receive_json(self, data, **kwargs):
        if isinstance(data, dict) and data.get("type") == "ping":
            await self.send_json({"type": "pong"})
            return
        error = await relay_call_signal(self.user, data)
        if error:
            await self.send_json({"type": "error", "message": error})

    async def call_signal_event(self, event):
        await self.send_json({
            "type": "incoming_call" if event["signal_type"] == "offer" else "call_signal",
            "from_user_id": event["from_user_id"],
            "caller_id": event["caller_id"],
            "caller_name": event["caller_name"],
            "caller_avatar": event["caller_avatar"],
            "conversation_id": event["conversation_id"],
            "call_id": event["call_id"],
            "call_type": event["call_type"],
            "signal_type": event["signal_type"],
            "signal": event["signal"],
            "status": event.get("status"),
        })


class ChatConsumer(AsyncWebsocketConsumer):

    async def connect(self):

        self.user = self.scope.get("user")

        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        self.conversation_id = (
            self.scope["url_route"]["kwargs"][
                "conversation_id"
            ]
        )

        allowed = await self.user_in_conversation()

        if not allowed:
            await self.close(code=4003)
            return

        self.room_group_name = (
            f"chat_{self.conversation_id}"
        )

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name,
        )

        await self.set_presence(True)

        await self.accept()

        await self.send(
            text_data=json.dumps({
                "type": "connection",
                "message": "Connected to RiceHub chat.",
            })
        )

    async def disconnect(self, close_code):

        if hasattr(
            self,
            "room_group_name"
        ):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name,
            )

        if self.user and self.user.is_authenticated:
            await self.set_presence(False)

    async def receive(self, text_data):

        try:
            data = json.loads(text_data)

        except json.JSONDecodeError:

            await self.send(
                text_data=json.dumps({
                    "type": "error",
                    "message": "Invalid JSON.",
                })
            )

            return

        event_type = data.get("type")

        # -----------------------------------------
        # HEARTBEAT
        # -----------------------------------------

        if event_type == "heartbeat":
            await self.update_last_seen()
            await self.send(text_data=json.dumps({
                "type": "heartbeat_ack",
                "timestamp": timezone.now().isoformat(),
            }))
            return

        elif event_type == "typing":   # <-- YE YAHAN ADD KARO
            if not await self.can_send_message():
                await self.send(text_data=json.dumps({
                    "type": "error",
                    "message": "This conversation is no longer available.",
                }))
                return
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "typing_event",
                    "user_id": self.user.id,
                    "is_typing": bool(data.get("is_typing")),
                },
            )
            return

        elif event_type == "read":
            result = await self.mark_messages_read()
            if result["enabled"] and result["message_ids"]:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "messages_seen",
                        "message_ids": result["message_ids"],
                        "reader_id": self.user.id,
                    },
                )
            return

        elif event_type == "call_signal":
            error = await relay_call_signal(
                self.user,
                {**data, "conversation_id": int(self.conversation_id)},
            )
            if error:
                await self.send_json({"type": "error", "message": error})
            return


        # -----------------------------------------
        # MESSAGE
        # -----------------------------------------

        elif event_type == "message":
            message_text = data.get(
                "message",
                ""
            ).strip()

            if not message_text:
                return

            if len(message_text) > 5000:
                await self.send(
                    text_data=json.dumps({
                        "type": "error",
                        "message": (
                            "Message cannot exceed "
                            "5000 characters."
                        ),
                    })
                )
                return

            reply_to_id = data.get("reply_to_id")
            if reply_to_id is not None and (
                not isinstance(reply_to_id, int)
                or isinstance(reply_to_id, bool)
            ):
                await self.send_json({
                    "type": "error",
                    "message": "Reply target is invalid.",
                })
                return
            result = await self.create_message(message_text, reply_to_id)
            if not result:
                await self.send(text_data=json.dumps({
                    "type": "error",
                    "message": "This conversation is no longer available.",
                }))
                return
            message, verification_warning = result

            chat_event = {
                "type": "chat_message",
                "message": {
                    "id": message.id,
                    "conversation": (
                        message.conversation_id
                    ),
                    "sender": message.sender_id,
                    "reply_to": (
                        {
                            "id": message.reply_to_id,
                            "content": (
                                "This message was deleted."
                                if message.reply_to.is_deleted
                                else message.reply_to.content
                            ),
                            "sender_id": message.reply_to.sender_id,
                        }
                        if message.reply_to_id
                        else None
                    ),
                    "reply_to_id": message.reply_to_id,
                    "sender_username": self.user.username,
                    "verification_warning": verification_warning,
                    "content": message.content,
                    "created_at": message.created_at.isoformat(),
                    "is_read": message.is_read,
                },
            }
            try:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    chat_event,
                )
            except (ChannelFull, RedisError, OSError, TimeoutError):
                logger.exception(
                    "Message %s was saved but could not be broadcast.",
                    message.id,
                )
                await self.chat_message(chat_event)

            return

    async def chat_message(self, event):

        await self.send(
            text_data=json.dumps({
                "type": "message",
                **event["message"],
            })
        )

    async def message_updated(self, event):
        await self.send_json({
            "type": "message_updated",
            "message": event["message"],
        })

    async def message_deleted(self, event):
        await self.send_json({
            "type": "message_deleted",
            "message_id": event["message_id"],
        })

    async def conversation_hidden(self, event):
        if event["user_id"] != self.user.id:
            return
        await self.send_json({
            "type": "conversation_hidden",
            "conversation_id": self.conversation_id,
        })
        await self.close(code=4003)

    async def typing_event(
        self,
        event,
    ):
        if event["user_id"] == self.user.id:
            return
        

        await self.send_json({
            "type": "typing",
            "user_id": event["user_id"],
            "is_typing": event["is_typing"],
        })

    async def messages_seen(self, event):
        if event["reader_id"] == self.user.id:
            return
        await self.send_json({
            "type": "seen",
            "message_ids": event["message_ids"],
            "reader_id": event["reader_id"],
        })

    async def call_signal_event(self, event):
        await self.send_json({
            "type": "call_signal",
            "from_user_id": event["from_user_id"],
            "caller_id": event["caller_id"],
            "caller_name": event["caller_name"],
            "caller_avatar": event["caller_avatar"],
            "conversation_id": event["conversation_id"],
            "call_id": event["call_id"],
            "call_type": event["call_type"],
            "signal_type": event["signal_type"],
            "signal": event["signal"],
            "status": event.get("status"),
        })

    @database_sync_to_async
    def user_in_conversation(self):
        conversation = (
            Conversation.objects
            .filter(
                id=self.conversation_id,
                participants=self.user,
            )
            .prefetch_related("participants")
            .first()
        )
        if not conversation:
            return False
        membership = ConversationMember.objects.filter(
            conversation=conversation,
            user=self.user,
        ).first()
        if membership and membership.deleted_at:
            return False
        if conversation.conversation_type == Conversation.ConversationType.GROUP:
            return bool(membership)
        other_user = conversation.participants.exclude(pk=self.user.pk).first()
        return bool(other_user and can_message_between(self.user, other_user))

    @database_sync_to_async
    def is_direct_call_peer(self, target_user_id):
        conversation = (
            Conversation.objects
            .filter(
                id=self.conversation_id,
                conversation_type=Conversation.ConversationType.DIRECT,
                participants=self.user,
            )
            .prefetch_related("participants")
            .first()
        )
        if not conversation:
            return False
        membership = ConversationMember.objects.filter(
            conversation=conversation,
            user=self.user,
        ).first()
        if membership and membership.deleted_at:
            return False
        other_user = conversation.participants.exclude(pk=self.user.pk).first()
        return bool(
            other_user
            and other_user.pk == target_user_id
            and can_message_between(self.user, other_user)
        )

    @database_sync_to_async
    def create_message(self, content, reply_to_id=None):

        conversation = (
            Conversation.objects
            .prefetch_related(
                "participants"
            )
            .get(
                id=self.conversation_id
            )
        )
        other_users = conversation.participants.exclude(pk=self.user.pk)
        if conversation.conversation_type == Conversation.ConversationType.DIRECT:
            other_user = other_users.first()
            if not other_user or not can_message_between(self.user, other_user):
                return None
        membership = ConversationMember.objects.filter(
            conversation=conversation,
            user=self.user,
        ).first()
        if membership and membership.deleted_at:
            return None
        if conversation.conversation_type == Conversation.ConversationType.GROUP:
            if not membership:
                return None
            if (
                conversation.admins_only
                and membership.role != ConversationMember.Role.ADMIN
            ):
                return None
        reply_to = None
        if reply_to_id is not None:
            reply_to = Message.objects.filter(
                pk=reply_to_id,
                conversation=conversation,
            ).first()
            if not reply_to:
                return None

        message = Message.objects.create(
            conversation=conversation,
            sender=self.user,
            content=content,
            reply_to=reply_to,
        )

        restore_conversation_memberships(conversation)
        conversation.save()

        verification_warning = not self.user.is_verified
        return message, verification_warning

    async def create_call_ended_message(
        self,
        call_id,
        status,
        caller_id=None,
        duration_seconds=None,
    ):
        return await save_call_ended_message(
            self.user,
            int(self.conversation_id),
            call_id,
            status,
            caller_id or self.user.pk,
            duration_seconds,
        )

    @database_sync_to_async
    def can_send_message(self):
        conversation = (
            Conversation.objects
            .filter(
                id=self.conversation_id,
                participants=self.user,
            )
            .prefetch_related("participants")
            .first()
        )
        if not conversation:
            return False
        membership = ConversationMember.objects.filter(
            conversation=conversation,
            user=self.user,
        ).first()
        if membership and membership.deleted_at:
            return False
        if conversation.conversation_type == Conversation.ConversationType.GROUP:
            return bool(
                membership
                and (
                    not conversation.admins_only
                    or membership.role == ConversationMember.Role.ADMIN
                )
            )
        other_user = conversation.participants.exclude(pk=self.user.pk).first()
        return bool(other_user and can_message_between(self.user, other_user))

    @database_sync_to_async
    def set_presence(self, online):

        User.objects.filter(
            id=self.user.id
        ).update(
            is_online=online,
            last_seen=timezone.now(),
        )

    @database_sync_to_async
    def update_last_seen(self):

        User.objects.filter(
            id=self.user.id
        ).update(
            is_online=True,
            last_seen=timezone.now(),
        )

    @database_sync_to_async
    def mark_messages_read(self):
        conversation = (
            Conversation.objects
            .filter(id=self.conversation_id, participants=self.user)
            .prefetch_related("participants")
            .first()
        )
        if not conversation:
            return {"enabled": False, "message_ids": []}
        membership = ConversationMember.objects.filter(
            conversation=conversation,
            user=self.user,
        ).first()
        if membership and membership.deleted_at:
            return {"enabled": False, "message_ids": []}
        if conversation.conversation_type == Conversation.ConversationType.DIRECT:
            other_user = conversation.participants.exclude(pk=self.user.pk).first()
            if not other_user or not can_message_between(self.user, other_user):
                return {"enabled": False, "message_ids": []}
        elif not conversation.participants.filter(pk=self.user.pk).exists():
            return {"enabled": False, "message_ids": []}
        privacy = getattr(self.user, "privacy_settings", None)
        if privacy and not privacy.read_receipts:
            return {"enabled": False, "message_ids": []}
        unread = conversation.messages.filter(is_read=False).exclude(sender=self.user)
        message_ids = list(unread.values_list("id", flat=True))
        unread.update(is_read=True)
        from .models import ConversationMember
        ConversationMember.objects.update_or_create(
            conversation=conversation,
            user=self.user,
            defaults={"last_read_at": timezone.now()},
        )
        return {"enabled": True, "message_ids": message_ids}
