from datetime import datetime
from unittest.mock import AsyncMock, patch
import uuid

from asgiref.sync import async_to_sync
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from friendships.models import FriendRequest
from messaging.models import (
    Conversation,
    ConversationMember,
    Message,
)
from messaging.consumers import CallSignalingConsumer, ChatConsumer
from users.models import ProfileVisibility
from users.models import UserPrivacySettings


User = get_user_model()


class MessagingFeatureTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="message-owner",
            email="owner@example.com",
            password="StrongPassword123",
            is_verified=True,
        )
        self.friend = User.objects.create_user(
            username="message-friend",
            email="friend@example.com",
            password="StrongPassword123",
            is_verified=True,
        )
        self.friend.profile_visibility = ProfileVisibility.PUBLIC
        self.friend.save(update_fields=["profile_visibility"])
        self.stranger = User.objects.create_user(
            username="message-stranger",
            email="stranger@example.com",
            password="StrongPassword123",
            is_verified=True,
        )
        self.conversation = Conversation.objects.create()
        self.conversation.participants.add(self.user, self.friend)
        self.client.force_authenticate(self.user)

    def make_friends(self):
        FriendRequest.objects.create(
            sender=self.user,
            receiver=self.friend,
            status=FriendRequest.Status.ACCEPTED,
        )

    def test_group_conversation_can_include_a_non_friend(self):
        response = self.client.post(
            "/api/messages/conversations/group/",
            {"name": "Study group", "user_ids": [self.stranger.pk]},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        conversation = Conversation.objects.get(pk=response.data["id"])
        self.assertTrue(
            conversation.participants.filter(pk=self.stranger.pk).exists()
        )

    def test_group_member_can_add_another_user_by_id(self):
        response = self.client.post(
            "/api/messages/conversations/group/",
            {"name": "Study group", "user_ids": [self.friend.pk]},
            format="json",
        )
        conversation_id = response.data["id"]

        added = self.client.post(
            f"/api/messages/conversations/{conversation_id}/members/",
            {"user_id": self.stranger.pk},
            format="json",
        )

        self.assertEqual(added.status_code, 200)
        conversation = Conversation.objects.get(pk=conversation_id)
        self.assertTrue(
            conversation.participants.filter(pk=self.stranger.pk).exists()
        )
        self.assertTrue(
            ConversationMember.objects.filter(
                conversation=conversation,
                user=self.stranger,
            ).exists()
        )

    def test_group_conversation_adds_creator_and_friend_as_members(self):
        self.make_friends()
        response = self.client.post(
            "/api/messages/conversations/group/",
            {"name": "Study group", "user_ids": [self.friend.pk]},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        conversation = Conversation.objects.get(pk=response.data["id"])
        self.assertEqual(
            conversation.conversation_type,
            Conversation.ConversationType.GROUP,
        )
        self.assertEqual(conversation.participants.count(), 2)
        self.assertEqual(
            ConversationMember.objects.get(
                conversation=conversation,
                user=self.user,
            ).role,
            ConversationMember.Role.ADMIN,
        )
        self.assertEqual(response.data["member_count"], 2)
        self.assertEqual(
            {
                item["user"]["id"]: item["role"]
                for item in response.data["memberships"]
            },
            {
                self.user.pk: ConversationMember.Role.ADMIN,
                self.friend.pk: ConversationMember.Role.MEMBER,
            },
        )

    def test_only_group_admin_can_add_members(self):
        created = self.client.post(
            "/api/messages/conversations/group/",
            {"name": "Study group", "user_ids": [self.friend.pk]},
            format="json",
        )
        self.client.force_authenticate(self.friend)

        response = self.client.post(
            f"/api/messages/conversations/{created.data['id']}/members/",
            {"user_id": self.stranger.pk},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(
            Conversation.objects.get(pk=created.data["id"])
            .participants.filter(pk=self.stranger.pk).exists()
        )

    def test_admin_can_promote_and_remove_group_members(self):
        created = self.client.post(
            "/api/messages/conversations/group/",
            {"name": "Study group", "user_ids": [self.friend.pk]},
            format="json",
        )
        conversation_id = created.data["id"]

        promoted = self.client.patch(
            f"/api/messages/conversations/{conversation_id}/members/{self.friend.pk}/",
            {"role": ConversationMember.Role.ADMIN},
            format="json",
        )

        self.assertEqual(promoted.status_code, 200)
        self.assertEqual(
            next(
                item["role"]
                for item in promoted.data["memberships"]
                if item["user"]["id"] == self.friend.pk
            ),
            ConversationMember.Role.ADMIN,
        )

        self.client.force_authenticate(self.friend)
        removed = self.client.delete(
            f"/api/messages/conversations/{conversation_id}/members/{self.user.pk}/"
        )

        self.assertEqual(removed.status_code, 200)
        self.assertFalse(
            Conversation.objects.get(pk=conversation_id)
            .participants.filter(pk=self.user.pk).exists()
        )

    def test_non_admin_cannot_promote_group_members(self):
        created = self.client.post(
            "/api/messages/conversations/group/",
            {"name": "Study group", "user_ids": [self.friend.pk]},
            format="json",
        )
        conversation_id = created.data["id"]
        self.client.force_authenticate(self.friend)

        response = self.client.patch(
            f"/api/messages/conversations/{conversation_id}/members/{self.user.pk}/",
            {"role": ConversationMember.Role.ADMIN},
            format="json",
        )
        settings_response = self.client.patch(
            f"/api/messages/conversations/{conversation_id}/settings/",
            {"admins_only": True},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(settings_response.status_code, 403)

    def test_mute_and_leave_group_are_user_specific(self):
        created = self.client.post(
            "/api/messages/conversations/group/",
            {"name": "Study group", "user_ids": [self.friend.pk]},
            format="json",
        )
        conversation_id = created.data["id"]
        self.client.patch(
            f"/api/messages/conversations/{conversation_id}/members/{self.friend.pk}/",
            {"role": ConversationMember.Role.ADMIN},
            format="json",
        )

        muted = self.client.patch(
            f"/api/messages/conversations/{conversation_id}/mute/",
            {"is_muted": True},
            format="json",
        )
        left = self.client.delete(
            f"/api/messages/conversations/{conversation_id}/leave/"
        )

        self.assertEqual(muted.status_code, 200)
        self.assertTrue(muted.data["is_muted"])
        self.assertEqual(left.status_code, 200)
        conversation = Conversation.objects.get(pk=conversation_id)
        self.assertFalse(conversation.participants.filter(pk=self.user.pk).exists())
        self.assertFalse(
            ConversationMember.objects.filter(
                conversation=conversation,
                user=self.user,
            ).exists()
        )

    def test_only_group_admin_can_send_when_admins_only_is_enabled(self):
        created = self.client.post(
            "/api/messages/conversations/group/",
            {"name": "Study group", "user_ids": [self.friend.pk]},
            format="json",
        )
        conversation = Conversation.objects.get(pk=created.data["id"])
        settings_response = self.client.patch(
            f"/api/messages/conversations/{conversation.pk}/settings/",
            {"admins_only": True},
            format="json",
        )
        self.assertEqual(settings_response.status_code, 200)
        self.assertTrue(settings_response.data["admins_only"])
        self.client.force_authenticate(self.friend)

        blocked = self.client.post(
            f"/api/messages/conversations/{conversation.pk}/messages/",
            {"content": "Member message"},
            format="json",
        )
        self.assertEqual(blocked.status_code, 403)

        self.client.force_authenticate(self.user)
        promoted = self.client.patch(
            f"/api/messages/conversations/{conversation.pk}/members/{self.friend.pk}/",
            {"role": ConversationMember.Role.ADMIN},
            format="json",
        )
        self.assertEqual(promoted.status_code, 200)
        self.client.force_authenticate(self.friend)
        allowed = self.client.post(
            f"/api/messages/conversations/{conversation.pk}/messages/",
            {"content": "Admin message"},
            format="json",
        )

        self.assertEqual(allowed.status_code, 201)

    def test_unverified_user_cannot_create_group(self):
        self.user.is_verified = False
        self.user.save(update_fields=["is_verified"])

        response = self.client.post(
            "/api/messages/conversations/group/",
            {"name": "Study group", "user_ids": [self.friend.pk]},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Only verified users", str(response.data))
        self.assertFalse(
            Conversation.objects.filter(name="Study group").exists()
        )

    def test_unverified_user_cannot_be_added_during_group_creation(self):
        self.stranger.is_verified = False
        self.stranger.save(update_fields=["is_verified"])

        response = self.client.post(
            "/api/messages/conversations/group/",
            {"name": "Study group", "user_ids": [self.stranger.pk]},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Only verified users", str(response.data))

    def test_unverified_user_cannot_be_added_to_existing_group(self):
        conversation = Conversation.objects.create(
            conversation_type=Conversation.ConversationType.GROUP,
            name="Study group",
            created_by=self.user,
        )
        conversation.participants.add(self.user)
        ConversationMember.objects.create(
            conversation=conversation,
            user=self.user,
            role=ConversationMember.Role.ADMIN,
        )
        self.stranger.is_verified = False
        self.stranger.save(update_fields=["is_verified"])

        response = self.client.post(
            f"/api/messages/conversations/{conversation.pk}/members/",
            {"user_id": self.stranger.pk},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Only verified users", str(response.data))
        self.assertFalse(
            conversation.participants.filter(pk=self.stranger.pk).exists()
        )

    def test_group_member_search_matches_name_username_and_id_only_if_verified(self):
        self.friend.first_name = "Jasmine"
        self.friend.last_name = "Rice"
        self.friend.save(update_fields=["first_name", "last_name"])
        self.stranger.is_verified = False
        self.stranger.save(update_fields=["is_verified"])
        endpoint = "/api/messages/group-members/search/"

        by_name = self.client.get(endpoint, {"q": "Jasmine"})
        by_username = self.client.get(endpoint, {"q": "message-friend"})
        by_id = self.client.get(endpoint, {"q": str(self.friend.pk)})
        unverified = self.client.get(endpoint, {"q": "message-stranger"})

        for response in (by_name, by_username, by_id):
            self.assertEqual(response.status_code, 200)
            self.assertIn(
                self.friend.pk,
                {user["id"] for user in response.data["results"]},
            )
        self.assertTrue(
            all(user["is_verified"] for user in by_name.data["results"])
        )
        self.assertNotIn(
            self.stranger.pk,
            {user["id"] for user in unverified.data["results"]},
        )

    def test_message_reply_must_belong_to_same_conversation(self):
        other_conversation = Conversation.objects.create()
        other_conversation.participants.add(self.user, self.stranger)
        reply_target = Message.objects.create(
            conversation=other_conversation,
            sender=self.stranger,
            content="Not in this chat",
        )
        response = self.client.post(
            f"/api/messages/conversations/{self.conversation.pk}/messages/",
            {"content": "Reply", "reply_to_id": reply_target.pk},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_conversation_participant_includes_privacy_aware_presence(self):
        self.friend.last_seen = timezone.now()
        self.friend.save(update_fields=("last_seen",))

        response = self.client.get("/api/messages/conversations/")

        self.assertEqual(response.status_code, 200)
        conversations = response.data["results"]
        participant = next(
            item
            for item in conversations[0]["participants"]
            if item["id"] == self.friend.pk
        )
        self.assertTrue(participant["is_online"])
        self.assertIsNotNone(participant["last_seen"])

        UserPrivacySettings.objects.create(
            user=self.friend,
            show_activity_status=False,
            show_last_seen=False,
        )
        response = self.client.get("/api/messages/conversations/")
        conversations = response.data["results"]
        participant = next(
            item
            for item in conversations[0]["participants"]
            if item["id"] == self.friend.pk
        )
        self.assertIsNone(participant["is_online"])
        self.assertIsNone(participant["last_seen"])

    def test_voice_note_upload_creates_audio_message(self):
        self.make_friends()
        voice_note = SimpleUploadedFile(
            "voice-note.webm",
            b"voice note payload",
            content_type="audio/webm",
        )

        response = self.client.post(
            f"/api/messages/conversations/{self.conversation.pk}/messages/",
            {
                "content": "",
                "attachment": voice_note,
                "attachment_type": Message.AttachmentType.AUDIO,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["attachment_type"], Message.AttachmentType.AUDIO)
        message = Message.objects.get(pk=response.data["id"])
        self.assertEqual(message.sender, self.user)
        self.assertTrue(message.attachment.name.endswith(".webm"))

    def test_sending_message_broadcasts_json_safe_timestamps(self):
        self.make_friends()

        class RecordingChannelLayer:
            event = None

            async def group_send(self, group, event):
                self.event = event

        channel_layer = RecordingChannelLayer()
        with patch("messaging.views.get_channel_layer", return_value=channel_layer):
            response = self.client.post(
                f"/api/messages/conversations/{self.conversation.pk}/messages/",
                {"content": "Hello"},
                format="json",
            )

        self.assertEqual(response.status_code, 201)
        self.assertIsInstance(channel_layer.event["message"]["created_at"], str)
        response_timestamp = response.data["created_at"]
        if isinstance(response_timestamp, str):
            response_timestamp = datetime.fromisoformat(
                response_timestamp.replace("Z", "+00:00")
            )
        broadcast_timestamp = datetime.fromisoformat(
            channel_layer.event["message"]["created_at"].replace("Z", "+00:00")
        )
        self.assertEqual(
            broadcast_timestamp,
            response_timestamp,
        )

    def test_sending_message_succeeds_when_broadcast_connection_is_down(self):
        self.make_friends()

        class OfflineChannelLayer:
            async def group_send(self, group, event):
                raise OSError("Channel layer unavailable")

        with patch(
            "messaging.views.get_channel_layer",
            return_value=OfflineChannelLayer(),
        ):
            response = self.client.post(
                f"/api/messages/conversations/{self.conversation.pk}/messages/",
                {"content": "Saved even when real-time is offline"},
                format="json",
            )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(
            Message.objects.filter(
                pk=response.data["id"],
                content="Saved even when real-time is offline",
            ).exists()
        )

    def test_image_and_video_uploads_create_typed_messages(self):
        self.make_friends()
        attachments = [
            ("photo.png", b"image payload", "image/png", Message.AttachmentType.IMAGE),
            ("clip.mp4", b"video payload", "video/mp4", Message.AttachmentType.VIDEO),
        ]

        for filename, payload, content_type, attachment_type in attachments:
            with self.subTest(attachment_type=attachment_type):
                upload = SimpleUploadedFile(
                    filename,
                    payload,
                    content_type=content_type,
                )
                response = self.client.post(
                    f"/api/messages/conversations/{self.conversation.pk}/messages/",
                    {
                        "content": "",
                        "attachment": upload,
                        "attachment_type": attachment_type,
                    },
                    format="multipart",
                )

                self.assertEqual(response.status_code, 201)
                self.assertEqual(response.data["attachment_type"], attachment_type)

    def test_video_upload_accepts_camera_recordings_over_ten_megabytes(self):
        self.make_friends()
        upload = SimpleUploadedFile(
            "camera-recording.mp4",
            b"v" * (10 * 1024 * 1024 + 1),
            content_type="video/mp4",
        )

        response = self.client.post(
            f"/api/messages/conversations/{self.conversation.pk}/messages/",
            {
                "content": "",
                "attachment": upload,
                "attachment_type": Message.AttachmentType.VIDEO,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["attachment_type"], Message.AttachmentType.VIDEO)

    def test_image_upload_rejects_mismatched_mime_type(self):
        self.make_friends()
        upload = SimpleUploadedFile(
            "photo.png",
            b"not an image",
            content_type="text/plain",
        )

        response = self.client.post(
            f"/api/messages/conversations/{self.conversation.pk}/messages/",
            {
                "content": "",
                "attachment": upload,
                "attachment_type": Message.AttachmentType.IMAGE,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)

    def test_message_sender_can_edit_and_delete_own_message(self):
        message = Message.objects.create(
            conversation=self.conversation,
            sender=self.user,
            content="Original",
        )
        edited = self.client.patch(
            f"/api/messages/messages/{message.pk}/edit/",
            {"content": "Updated"},
            format="json",
        )
        self.assertEqual(edited.status_code, 200)
        self.assertEqual(edited.data["content"], "Updated")

        deleted = self.client.delete(
            f"/api/messages/messages/{message.pk}/delete/"
        )
        self.assertEqual(deleted.status_code, 200)
        message.refresh_from_db()
        self.assertTrue(message.is_deleted)
        self.assertEqual(message.content, "")

    def test_sender_cannot_edit_another_users_message(self):
        message = Message.objects.create(
            conversation=self.conversation,
            sender=self.friend,
            content="Not yours",
        )
        response = self.client.patch(
            f"/api/messages/messages/{message.pk}/edit/",
            {"content": "Changed"},
            format="json",
        )
        self.assertEqual(response.status_code, 404)

    def test_archive_state_is_private_to_each_conversation_member(self):
        response = self.client.patch(
            f"/api/messages/conversations/{self.conversation.pk}/archive/",
            {"is_archived": True},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["is_archived"])
        self.assertEqual(
            self.client.get("/api/messages/conversations/").data["results"],
            [],
        )
        archived = self.client.get(
            "/api/messages/conversations/",
            {"archived": "true"},
        )
        self.assertEqual(
            [item["id"] for item in archived.data["results"]],
            [self.conversation.pk],
        )

        self.client.force_authenticate(self.friend)
        friend_conversations = self.client.get("/api/messages/conversations/")
        self.assertEqual(
            [item["id"] for item in friend_conversations.data["results"]],
            [self.conversation.pk],
        )
        self.assertFalse(friend_conversations.data["results"][0]["is_archived"])

    def test_delete_hides_conversation_only_for_requesting_user(self):
        deleted = self.client.delete(
            f"/api/messages/conversations/{self.conversation.pk}/delete/"
        )

        self.assertEqual(deleted.status_code, 200)
        self.assertEqual(
            self.client.get("/api/messages/conversations/").data["results"],
            [],
        )
        membership = ConversationMember.objects.get(
            conversation=self.conversation,
            user=self.user,
        )
        self.assertIsNotNone(membership.deleted_at)

        self.client.force_authenticate(self.friend)
        friend_conversations = self.client.get("/api/messages/conversations/")
        self.assertEqual(
            [item["id"] for item in friend_conversations.data["results"]],
            [self.conversation.pk],
        )

    def test_new_message_restores_a_deleted_conversation_for_members(self):
        self.client.delete(
            f"/api/messages/conversations/{self.conversation.pk}/delete/"
        )
        self.client.force_authenticate(self.friend)

        with patch("messaging.views.get_channel_layer", return_value=None):
            response = self.client.post(
                f"/api/messages/conversations/{self.conversation.pk}/messages/",
                {"content": "A new message"},
                format="json",
            )

        self.assertEqual(response.status_code, 201)
        self.client.force_authenticate(self.user)
        conversations = self.client.get("/api/messages/conversations/")
        self.assertEqual(
            [item["id"] for item in conversations.data["results"]],
            [self.conversation.pk],
        )


class AdminsOnlyGroupConsumerTests(TransactionTestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="group-admin",
            email="group-admin@example.com",
            password="StrongPassword123",
            is_verified=True,
        )
        self.member = User.objects.create_user(
            username="group-member",
            email="group-member@example.com",
            password="StrongPassword123",
            is_verified=True,
        )
        self.conversation = Conversation.objects.create(
            conversation_type=Conversation.ConversationType.GROUP,
            name="Admins only",
            admins_only=True,
            created_by=self.admin,
        )
        self.conversation.participants.add(self.admin, self.member)
        ConversationMember.objects.create(
            conversation=self.conversation,
            user=self.admin,
            role=ConversationMember.Role.ADMIN,
        )
        ConversationMember.objects.create(
            conversation=self.conversation,
            user=self.member,
        )

    def test_websocket_blocks_member_sends_until_promoted(self):
        consumer = ChatConsumer()
        consumer.user = self.member
        consumer.conversation_id = self.conversation.pk

        self.assertFalse(async_to_sync(consumer.can_send_message)())
        self.assertIsNone(
            async_to_sync(consumer.create_message)("Blocked message")
        )

        ConversationMember.objects.filter(
            conversation=self.conversation,
            user=self.member,
        ).update(role=ConversationMember.Role.ADMIN)

        self.assertTrue(async_to_sync(consumer.can_send_message)())
        message, _ = async_to_sync(consumer.create_message)("Allowed message")
        self.assertEqual(message.content, "Allowed message")


class CallEndedMessageTests(TransactionTestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="call-owner",
            email="call-owner@example.com",
            password="StrongPassword123",
            is_verified=True,
        )
        self.friend = User.objects.create_user(
            username="call-friend",
            email="call-friend@example.com",
            password="StrongPassword123",
            is_verified=True,
        )
        self.conversation = Conversation.objects.create()
        self.conversation.participants.add(self.user, self.friend)

    def test_unanswered_call_is_saved_once_with_the_shared_call_id(self):
        consumer = ChatConsumer()
        consumer.user = self.user
        consumer.conversation_id = self.conversation.pk
        call_id = uuid.uuid4()

        result, created = async_to_sync(consumer.create_call_ended_message)(
            call_id,
            "cancelled",
        )
        consumer.user = self.friend
        second_result, second_created = async_to_sync(
            consumer.create_call_ended_message
        )(call_id, "missed")

        self.assertTrue(created)
        self.assertFalse(second_created)
        self.assertEqual(result["id"], second_result["id"])
        self.assertEqual(result["content"], "Call ended")
        self.assertEqual(result["sender"], self.user.pk)
        self.assertEqual(
            Message.objects.filter(
                conversation=self.conversation,
                call_id=call_id,
            ).count(),
            1,
        )

    def test_personal_signaling_routes_to_the_recipient_user_group(self):
        consumer = CallSignalingConsumer()
        consumer.user = self.user
        consumer.channel_layer = type("Layer", (), {"group_send": AsyncMock()})()
        consumer.send_json = AsyncMock()
        call_id = uuid.uuid4()

        async_to_sync(consumer.receive_json)({
            "type": "call_signal",
            "to_user_id": self.friend.id,
            "conversation_id": self.conversation.id,
            "call_id": str(call_id),
            "call_type": "audio",
            "signal_type": "offer",
            "signal": {"type": "offer", "sdp": "v=0\r\nm=audio\r\n"},
        })

        consumer.channel_layer.group_send.assert_awaited_once()
        group_name, event = consumer.channel_layer.group_send.await_args.args
        self.assertEqual(group_name, f"user_{self.friend.id}")
        self.assertEqual(event["caller_id"], self.user.id)
        self.assertEqual(event["caller_name"], self.user.username)
        self.assertIsNone(event["caller_avatar"])
        self.assertEqual(event["conversation_id"], self.conversation.id)
        self.assertEqual(event["call_type"], "audio")
        self.assertEqual(event["call_id"], str(call_id))
        self.assertFalse(Message.objects.filter(call_id=call_id).exists())
