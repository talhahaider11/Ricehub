from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APITestCase

from friendships.models import FriendRequest
from messaging.models import (
    Conversation,
    ConversationMember,
    Message,
)
from users.models import UserPrivacySettings


User = get_user_model()


class MessagingFeatureTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="message-owner",
            email="owner@example.com",
            password="StrongPassword123",
        )
        self.friend = User.objects.create_user(
            username="message-friend",
            email="friend@example.com",
            password="StrongPassword123",
        )
        self.stranger = User.objects.create_user(
            username="message-stranger",
            email="stranger@example.com",
            password="StrongPassword123",
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

    def test_group_conversation_requires_existing_friend(self):
        response = self.client.post(
            "/api/messages/conversations/group/",
            {"name": "Study group", "user_ids": [self.stranger.pk]},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(
            Conversation.objects.filter(
                conversation_type=Conversation.ConversationType.GROUP
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
