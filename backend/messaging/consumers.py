import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from django.contrib.auth import get_user_model
from django.utils import timezone

from .models import Conversation, ConversationMember, Message
from users.privacy import can_message_between


User = get_user_model()
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
            signal_type = data.get("signal_type")
            target_user_id = data.get("to_user_id")
            signal = data.get("signal", {})
            valid_target_id = (
                isinstance(target_user_id, int)
                and not isinstance(target_user_id, bool)
            )
            if (
                not isinstance(signal_type, str)
                or signal_type not in {"offer", "answer", "ice_candidate", "hangup"}
                or not valid_target_id
                or not isinstance(signal, dict)
                or len(json.dumps(signal)) > 20_000
            ):
                await self.send_json({
                    "type": "error",
                    "message": "Call signal is invalid.",
                })
                return
            if (
                not await self.can_send_message()
                or not await self.is_direct_call_peer(target_user_id)
            ):
                await self.send_json({
                    "type": "error",
                    "message": "This conversation is not available for audio calls.",
                })
                return
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "call_signal_event",
                    "from_user_id": self.user.id,
                    "to_user_id": target_user_id,
                    "signal_type": signal_type,
                    "signal": signal,
                },
            )
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

            await self.channel_layer.group_send(
                self.room_group_name,
                {
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
                        "sender_username": (
                            self.user.username
                        ),
                        "verification_warning": verification_warning,
                        "content": message.content,
                        "created_at": (
                            message.created_at.isoformat()
                        ),
                        "is_read": message.is_read,
                    },
                },
            )

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
        if event["to_user_id"] != self.user.id:
            return
        await self.send_json({
            "type": "call_signal",
            "from_user_id": event["from_user_id"],
            "signal_type": event["signal_type"],
            "signal": event["signal"],
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
        if conversation.conversation_type == Conversation.ConversationType.GROUP:
            return True
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

        conversation.save()

        verification_warning = not self.user.is_verified
        return message, verification_warning

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
        if conversation.conversation_type == Conversation.ConversationType.GROUP:
            return True
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
