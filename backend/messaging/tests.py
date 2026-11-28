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
from notifications.models import Notification
from messaging.models import (
    CallInvitation,
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

    def test_sent_chat_message_creates_a_sender_preview_notification(self):
        self.make_friends()

        response = self.client.post(
            f"/api/messages/conversations/{self.conversation.pk}/messages/",
            {"content": "Can you review this?"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        notification = Notification.objects.get(recipient=self.friend)
        self.assertEqual(
            notification.notification_type,
            Notification.NotificationType.MESSAGE,
        )
        self.assertEqual(notification.message, "Can you review this?")
        self.assertEqual(notification.conversation_id, self.conversation.pk)

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

    def test_conversation_list_returns_lightweight_last_message_and_unread_count(self):
        message = Message.objects.create(
            conversation=self.conversation,
            sender=self.friend,
            content="",
            attachment="messages/photo.jpg",
            attachment_type=Message.AttachmentType.IMAGE,
        )

        response = self.client.get("/api/messages/conversations/")

        self.assertEqual(response.status_code, 200)
        conversation = response.data["results"][0]
        self.assertEqual(conversation["last_message"]["id"], message.pk)
        self.assertEqual(conversation["last_message"]["sender"]["id"], self.friend.pk)
        self.assertEqual(conversation["last_message"]["attachment"], "available")
        self.assertEqual(conversation["unread_count"], 1)

    def test_message_history_starts_with_latest_30_and_paginates_older_messages(self):
        for index in range(35):
            Message.objects.create(
                conversation=self.conversation,
                sender=self.user,
                content=f"Message {index}",
            )

        response = self.client.get(
            f"/api/messages/conversations/{self.conversation.pk}/messages/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 30)
        self.assertIsNotNone(response.data["next"])
        self.assertEqual(response.data["results"][0]["content"], "Message 34")

        older_response = self.client.get(
            f"/api/messages/conversations/{self.conversation.pk}/messages/?page=2"
        )
        self.assertEqual(len(older_response.data["results"]), 5)

    def test_message_history_can_sync_only_messages_after_cached_id(self):
        messages = [
            Message.objects.create(
                conversation=self.conversation,
                sender=self.user,
                content=f"Message {index}",
            )
            for index in range(35)
        ]

        response = self.client.get(
            f"/api/messages/conversations/{self.conversation.pk}/messages/"
            f"?after_id={messages[31].pk}"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [message["content"] for message in response.data["results"]],
            ["Message 34", "Message 33", "Message 32"],
        )
        self.assertIsNone(response.data["next"])

        invalid_response = self.client.get(
            f"/api/messages/conversations/{self.conversation.pk}/messages/"
            "?after_id=invalid"
        )
        self.assertEqual(invalid_response.status_code, 400)
        self.assertIn("after_id", invalid_response.data)

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

    def test_hard_deleting_a_message_removes_its_oci_attachment(self):
        message = Message.objects.create(
            conversation=self.conversation,
            sender=self.user,
            content="Attachment",
        )
        message.attachment.name = "chat_media/2026/11/attachment.jpg"
        message.save(update_fields=["attachment"])
        attachment_storage = message.attachment.storage

        with patch.object(attachment_storage, "delete") as delete_file:
            with self.captureOnCommitCallbacks(execute=True):
                message.delete()

        delete_file.assert_called_once_with(
            "chat_media/2026/11/attachment.jpg"
        )

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

    def test_websocket_marks_unread_messages_read(self):
        message = Message.objects.create(
            conversation=self.conversation,
            sender=self.admin,
            content="Read receipt check",
        )
        consumer = ChatConsumer()
        consumer.user = self.member
        consumer.conversation_id = self.conversation.pk

        result = async_to_sync(consumer.mark_messages_read)()

        message.refresh_from_db()
        membership = ConversationMember.objects.get(
            conversation=self.conversation,
            user=self.member,
        )
        self.assertTrue(result["enabled"])
        self.assertEqual(result["message_ids"], [message.pk])
        self.assertTrue(message.is_read)
        self.assertIsNotNone(membership.last_read_at)


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
            caller_id=self.user.pk,
        )
        consumer.user = self.friend
        second_result, second_created = async_to_sync(
            consumer.create_call_ended_message
        )(call_id, "missed", caller_id=self.user.pk)

        self.assertTrue(created)
        self.assertFalse(second_created)
        self.assertEqual(result["id"], second_result["id"])
        self.assertEqual(result["content"], "")
        self.assertEqual(result["message_type"], "call_log")
        self.assertEqual(result["call_status"], "cancelled")
        self.assertEqual(result["sender"], self.user.pk)
        self.assertEqual(
            Message.objects.filter(
                conversation=self.conversation,
                call_id=call_id,
            ).count(),
            1,
        )

    @patch("messaging.consumers.get_channel_layer")
    def test_personal_signaling_routes_to_the_recipient_user_group(self, get_layer):
        consumer = CallSignalingConsumer()
        consumer.user = self.user
        channel_layer = type("Layer", (), {"group_send": AsyncMock()})()
        get_layer.return_value = channel_layer
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

        channel_layer.group_send.assert_awaited_once()
        group_name, event = channel_layer.group_send.await_args.args
        self.assertEqual(group_name, f"user_{self.friend.id}")
        self.assertEqual(event["caller_id"], self.user.id)
        self.assertEqual(event["caller_name"], self.user.username)
        self.assertIsNone(event["caller_avatar"])
        self.assertEqual(event["conversation_id"], self.conversation.id)
        self.assertEqual(event["call_type"], "audio")
        self.assertEqual(event["call_id"], str(call_id))
        self.assertEqual(event["call_type"], "audio")
        self.assertFalse(Message.objects.filter(call_id=call_id).exists())

    def test_incoming_offer_is_sent_as_an_incoming_call_event(self):
        consumer = CallSignalingConsumer()
        consumer.send_json = AsyncMock()

        async_to_sync(consumer.call_signal_event)({
            "from_user_id": self.user.pk,
            "caller_id": self.user.pk,
            "caller_name": self.user.username,
            "caller_avatar": None,
            "conversation_id": self.conversation.pk,
            "call_id": str(uuid.uuid4()),
            "call_type": "audio",
            "signal_type": "offer",
            "signal": {"type": "offer", "sdp": "v=0\r\nm=audio\r\n"},
        })

        event = consumer.send_json.await_args.args[0]
        self.assertEqual(event["type"], "incoming_call")
        self.assertEqual(event["caller_id"], self.user.pk)
        self.assertEqual(event["caller_name"], self.user.username)
        self.assertEqual(event["conversation_id"], self.conversation.pk)
        self.assertEqual(event["signal_type"], "offer")

    def test_call_socket_responds_to_heartbeats(self):
        consumer = CallSignalingConsumer()
        consumer.send_json = AsyncMock()

        async_to_sync(consumer.receive_json)({"type": "ping"})

        consumer.send_json.assert_awaited_once_with({"type": "pong"})


class CallSignalFallbackTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="fallback-caller",
            email="fallback-caller@example.com",
            password="StrongPassword123",
            is_verified=True,
        )
        self.friend = User.objects.create_user(
            username="fallback-friend",
            email="fallback-friend@example.com",
            password="StrongPassword123",
            is_verified=True,
        )
        self.conversation = Conversation.objects.create()
        self.conversation.participants.add(self.user, self.friend)
        self.client.force_authenticate(self.user)

    @patch("messaging.consumers.get_channel_layer")
    def test_rest_fallback_routes_call_signal_to_user_group(self, get_layer):
        channel_layer = type("Layer", (), {"group_send": AsyncMock()})()
        get_layer.return_value = channel_layer
        call_id = uuid.uuid4()

        response = self.client.post(
            "/api/messages/calls/signal/",
            {
                "type": "call_signal",
                "to_user_id": self.friend.pk,
                "conversation_id": self.conversation.pk,
                "call_id": str(call_id),
                "call_type": "audio",
                "signal_type": "offer",
                "signal": {"type": "offer", "sdp": "v=0\r\nm=audio\r\n"},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        channel_layer.group_send.assert_awaited_once()
        group_name, event = channel_layer.group_send.await_args.args
        self.assertEqual(group_name, f"user_{self.friend.pk}")
        self.assertEqual(event["caller_id"], self.user.pk)
        self.assertEqual(event["conversation_id"], self.conversation.pk)
        self.assertEqual(event["signal_type"], "offer")
        self.assertFalse(Message.objects.filter(call_id=call_id).exists())

    @patch("messaging.consumers.get_channel_layer")
    def test_initiated_call_is_available_to_poll_and_removed_after_answer(
        self,
        get_layer,
    ):
        channel_layer = type("Layer", (), {"group_send": AsyncMock()})()
        get_layer.return_value = channel_layer
        call_id = uuid.uuid4()
        offer = {
            "type": "call_signal",
            "to_user_id": self.friend.pk,
            "conversation_id": self.conversation.pk,
            "call_id": str(call_id),
            "call_type": "audio",
            "signal_type": "offer",
            "signal": {"type": "offer", "sdp": "v=0\r\nm=audio\r\n"},
        }

        response = self.client.post(
            "/api/calls/initiate/",
            offer,
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        invitation = CallInvitation.objects.get(call_id=call_id)
        self.assertEqual(invitation.state, CallInvitation.State.RINGING)
        call_notification = Notification.objects.get(call_id=call_id)
        self.assertEqual(
            call_notification.notification_type,
            Notification.NotificationType.VOICE_CALL,
        )
        self.assertEqual(call_notification.conversation_id, self.conversation.pk)

        self.client.force_authenticate(self.friend)
        incoming_response = self.client.get("/api/calls/incoming/")
        self.assertEqual(len(incoming_response.data), 1)
        self.assertEqual(incoming_response.data[0]["call_id"], str(call_id))
        self.assertEqual(incoming_response.data[0]["signal"], offer["signal"])

        answer = {
            **offer,
            "to_user_id": self.user.pk,
            "caller_id": self.user.pk,
            "signal_type": "answer",
            "signal": {"type": "answer", "sdp": "v=0\r\nm=audio\r\n"},
        }
        answer_response = self.client.post(
            "/api/messages/calls/signal/",
            answer,
            format="json",
        )
        self.assertEqual(answer_response.status_code, 200)
        invitation.refresh_from_db()
        self.assertEqual(invitation.state, CallInvitation.State.ANSWERED)
        self.assertEqual(self.client.get("/api/calls/incoming/").data, [])

    @patch("messaging.consumers.get_channel_layer")
    def test_call_offer_is_still_queued_when_channel_delivery_times_out(
        self,
        get_layer,
    ):
        channel_layer = type(
            "Layer",
            (),
            {"group_send": AsyncMock(side_effect=TimeoutError)},
        )()
        get_layer.return_value = channel_layer
        call_id = uuid.uuid4()

        response = self.client.post(
            "/api/calls/initiate/",
            {
                "type": "call_signal",
                "to_user_id": self.friend.pk,
                "conversation_id": self.conversation.pk,
                "call_id": str(call_id),
                "call_type": "audio",
                "signal_type": "offer",
                "signal": {"type": "offer", "sdp": "v=0\r\nm=audio\r\n"},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 202)
        self.assertTrue(CallInvitation.objects.filter(call_id=call_id).exists())
        self.client.force_authenticate(self.friend)
        self.assertEqual(len(self.client.get("/api/calls/incoming/").data), 1)

    @patch("messaging.consumers.get_channel_layer")
    def test_rest_fallback_rejects_video_sdp(self, get_layer):
        get_layer.return_value = type("Layer", (), {"group_send": AsyncMock()})()
        response = self.client.post(
            "/api/messages/calls/signal/",
            {
                "type": "call_signal",
                "to_user_id": self.friend.pk,
                "conversation_id": self.conversation.pk,
                "call_id": str(uuid.uuid4()),
                "call_type": "video",
                "signal_type": "offer",
                "signal": {"type": "offer", "sdp": "v=0\r\nm=video\r\n"},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["detail"], "Only audio calls are supported.")

    @patch("messaging.consumers.get_channel_layer")
    def test_call_end_fallback_persists_one_structured_log(self, get_layer):
        channel_layer = type("Layer", (), {"group_send": AsyncMock()})()
        get_layer.return_value = channel_layer
        call_id = uuid.uuid4()
        payload = {
            "type": "call_signal",
            "to_user_id": self.friend.pk,
            "conversation_id": self.conversation.pk,
            "caller_id": self.user.pk,
            "call_id": str(call_id),
            "call_type": "audio",
            "signal_type": "hangup",
            "signal": {},
            "status": "completed",
            "duration_seconds": 43,
        }

        response = self.client.post(
            "/api/messages/calls/signal/",
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        call_log = Message.objects.get(call_id=call_id)
        self.assertEqual(call_log.message_type, Message.MessageType.CALL_LOG)
        self.assertEqual(call_log.call_status, Message.CallStatus.COMPLETED)
        self.assertEqual(call_log.call_duration_seconds, 43)
        self.assertEqual(call_log.sender_id, self.user.pk)

        self.client.force_authenticate(self.friend)
        payload.update({
            "to_user_id": self.user.pk,
            "signal_type": "hangup",
            "status": "missed",
        })
        duplicate_response = self.client.post(
            "/api/messages/calls/signal/",
            payload,
            format="json",
        )

        self.assertEqual(duplicate_response.status_code, 200)
        self.assertEqual(Message.objects.filter(call_id=call_id).count(), 1)
        call_log.refresh_from_db()
        self.assertEqual(call_log.call_status, Message.CallStatus.COMPLETED)
