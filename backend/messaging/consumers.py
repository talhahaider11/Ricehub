import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from django.contrib.auth import get_user_model
from django.utils import timezone

from .models import Conversation, Message
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

            message = await self.create_message(
                message_text
            )
            if not message:
                await self.send(text_data=json.dumps({
                    "type": "error",
                    "message": "This conversation is no longer available.",
                }))
                return

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
                        "sender_username": (
                            self.user.username
                        ),
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
        other_user = conversation.participants.exclude(
            pk=self.user.pk
        ).first()
        return bool(
            other_user and can_message_between(self.user, other_user)
        )

    @database_sync_to_async
    def create_message(self, content):

        conversation = (
            Conversation.objects
            .prefetch_related(
                "participants"
            )
            .get(
                id=self.conversation_id
            )
        )
        other_user = conversation.participants.exclude(
            pk=self.user.pk
        ).first()
        if not other_user or not can_message_between(self.user, other_user):
            return None

        message = Message.objects.create(
            conversation=conversation,
            sender=self.user,
            content=content,
        )

        conversation.save()

        return message

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
        other_user = conversation.participants.exclude(
            pk=self.user.pk
        ).first()
        return bool(
            other_user and can_message_between(self.user, other_user)
        )

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
        other_user = conversation.participants.exclude(pk=self.user.pk).first()
        if not other_user or not can_message_between(self.user, other_user):
            return {"enabled": False, "message_ids": []}
        privacy = getattr(self.user, "privacy_settings", None)
        if privacy and not privacy.read_receipts:
            return {"enabled": False, "message_ids": []}
        unread = conversation.messages.filter(is_read=False).exclude(sender=self.user)
        message_ids = list(unread.values_list("id", flat=True))
        unread.update(is_read=True)
        return {"enabled": True, "message_ids": message_ids}
