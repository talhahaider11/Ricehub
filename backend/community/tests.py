from datetime import timedelta
from io import BytesIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from PIL import Image
from rest_framework.test import APITestCase

from .models import (
    Community,
    CommunityMembership,
    CommunityPost,
    CommunityPostComment,
    CommunityPostLike,
    Event,
    EventAttendance,
    EventInvitation,
    MarketplaceListing,
    MarketplaceOrder,
    Story,
    StoryView,
)
from .event_cleanup import cleanup_expired_event_media
from messaging.models import Conversation, ConversationMember


User = get_user_model()


class CommunityFeatureTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="community-user",
            email="community@example.com",
            password="StrongPassword123",
        )
        self.other = User.objects.create_user(
            username="other-community-user",
            email="other-community@example.com",
            password="StrongPassword123",
        )
        self.client.force_authenticate(self.user)

    def test_stories_expire_after_twenty_four_hours(self):
        active_story = Story.objects.create(author=self.other, text="Still here")
        Story.objects.create(
            author=self.other,
            text="Expired",
            visibility=Story.Visibility.PUBLIC,
            expires_at=timezone.now() - timedelta(seconds=1),
        )
        active_story.visibility = Story.Visibility.PUBLIC
        active_story.save(update_fields=["visibility"])

        response = self.client.get("/api/community/stories/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.data["results"]], [active_story.id])

    def test_story_list_can_be_filtered_by_any_author(self):
        own_story = Story.objects.create(author=self.user, text="My story")
        other_story = Story.objects.create(
            author=self.other,
            text="Their story",
            visibility=Story.Visibility.PUBLIC,
        )

        response = self.client.get(
            "/api/community/stories/",
            {"author": self.other.id},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.data["results"]], [other_story.id])
        self.assertNotIn(own_story.id, [item["id"] for item in response.data["results"]])

    def test_story_list_rejects_invalid_author_filter(self):
        response = self.client.get(
            "/api/community/stories/",
            {"author": "not-a-user-id"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("author", response.data)

    def test_user_can_create_a_story(self):
        response = self.client.post(
            "/api/community/stories/",
            {"text": "Shared from the stories bar"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["text"], "Shared from the stories bar")
        self.assertEqual(response.data["author"]["id"], self.user.id)

    def test_story_owner_can_see_viewers_and_viewer_is_counted_once(self):
        story = Story.objects.create(
            author=self.other,
            text="Story",
            visibility=Story.Visibility.PUBLIC,
        )
        view_url = f"/api/community/stories/{story.id}/views/"

        first_view = self.client.post(view_url)
        second_view = self.client.post(view_url)
        self.assertEqual(first_view.status_code, 201)
        self.assertEqual(second_view.status_code, 201)
        self.assertEqual(StoryView.objects.filter(story=story).count(), 1)

        self.client.force_authenticate(self.other)
        viewers = self.client.get(view_url)
        self.assertEqual(viewers.status_code, 200)
        self.assertEqual(viewers.data[0]["viewer"]["id"], self.user.id)

    def test_public_group_posts_are_readable_without_membership_but_posting_requires_it(self):
        group = Community.objects.create(
            owner=self.other,
            name="Public group",
            kind=Community.Kind.GROUP,
        )
        CommunityMembership.objects.create(
            community=group,
            user=self.other,
            role=CommunityMembership.Role.ADMIN,
        )
        existing_post = CommunityPost.objects.create(
            community=group,
            author=self.other,
            content="Public post",
        )
        posts_url = f"/api/community/communities/{group.id}/posts/"
        viewed = self.client.get(posts_url)
        denied = self.client.post(
            posts_url,
            {"content": "Not joined"},
            format="json",
        )
        viewed_posts = (
            viewed.data.get("results", viewed.data)
            if isinstance(viewed.data, dict)
            else viewed.data
        )
        self.assertEqual(viewed.status_code, 200)
        self.assertEqual([post["id"] for post in viewed_posts], [existing_post.id])
        self.assertEqual(denied.status_code, 403)

        CommunityMembership.objects.create(community=group, user=self.user)
        created = self.client.post(
            posts_url,
            {"content": "Member post"},
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        post_id = created.data["id"]

        self.client.force_authenticate(self.other)
        removed = self.client.delete(f"/api/community/community-posts/{post_id}/")
        self.assertEqual(removed.status_code, 204)
        self.assertFalse(CommunityPost.objects.filter(pk=post_id).exists())

    def test_private_community_posts_are_hidden_from_non_members(self):
        private_group = Community.objects.create(
            owner=self.other,
            name="Private group",
            kind=Community.Kind.GROUP,
            visibility=Community.Visibility.PRIVATE,
        )

        response = self.client.get(
            f"/api/community/communities/{private_group.id}/posts/"
        )

        self.assertEqual(response.status_code, 403)

    def test_verified_page_owner_can_publish_and_public_users_can_like_and_comment(self):
        page = Community.objects.create(
            owner=self.other,
            name="Rice page",
            kind=Community.Kind.PAGE,
        )
        CommunityMembership.objects.create(
            community=page,
            user=self.other,
            role=CommunityMembership.Role.ADMIN,
        )
        self.other.is_verified = True
        self.other.save(update_fields=["is_verified"])
        self.client.force_authenticate(self.other)

        created = self.client.post(
            f"/api/community/communities/{page.id}/posts/",
            {"content": "Fresh rice from the farm"},
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        post_id = created.data["id"]

        self.client.force_authenticate(self.user)
        posts = self.client.get(f"/api/community/communities/{page.id}/posts/")
        self.assertEqual(posts.status_code, 200)
        post_list = (
            posts.data.get("results", posts.data)
            if isinstance(posts.data, dict)
            else posts.data
        )
        post_data = next(post for post in post_list if post["id"] == post_id)
        self.assertFalse(post_data["is_liked"])
        self.assertEqual(post_data["likes_count"], 0)
        self.assertEqual(post_data["comments_count"], 0)

        liked = self.client.post(
            f"/api/community/community-posts/{post_id}/like/"
        )
        unliked = self.client.post(
            f"/api/community/community-posts/{post_id}/like/"
        )
        commented = self.client.post(
            f"/api/community/community-posts/{post_id}/comments/",
            {"content": "Looks great!"},
            format="json",
        )

        self.assertEqual(liked.status_code, 200)
        self.assertTrue(liked.data["is_liked"])
        self.assertEqual(liked.data["likes_count"], 1)
        self.assertFalse(unliked.data["is_liked"])
        self.assertEqual(unliked.data["likes_count"], 0)
        self.assertEqual(commented.status_code, 201)
        self.assertEqual(commented.data["content"], "Looks great!")
        self.assertEqual(CommunityPostLike.objects.filter(post_id=post_id).count(), 0)
        self.assertEqual(
            CommunityPostComment.objects.filter(post_id=post_id).count(),
            1,
        )

    def test_only_verified_page_owner_can_publish_page_posts(self):
        page = Community.objects.create(
            owner=self.other,
            name="Rice page",
            kind=Community.Kind.PAGE,
        )
        CommunityMembership.objects.create(
            community=page,
            user=self.other,
            role=CommunityMembership.Role.ADMIN,
        )
        url = f"/api/community/communities/{page.id}/posts/"

        self.client.force_authenticate(self.other)
        unverified = self.client.post(
            url,
            {"content": "Unverified page post"},
            format="json",
        )
        self.assertEqual(unverified.status_code, 403)
        self.assertIn("verified", unverified.data["detail"].lower())

        self.other.is_verified = True
        self.other.save(update_fields=["is_verified"])
        self.client.force_authenticate(self.user)
        non_owner = self.client.post(
            url,
            {"content": "Post by another verified user"},
            format="json",
        )
        self.assertEqual(non_owner.status_code, 403)
        self.assertFalse(CommunityPost.objects.filter(community=page).exists())

    def test_community_admin_can_edit_details_but_non_admin_cannot(self):
        community = Community.objects.create(
            owner=self.other,
            name="Original",
            kind=Community.Kind.PAGE,
        )
        CommunityMembership.objects.create(
            community=community,
            user=self.other,
            role=CommunityMembership.Role.ADMIN,
        )

        denied = self.client.patch(
            f"/api/community/communities/{community.id}/",
            {"name": "Changed by member"},
            format="json",
        )
        self.assertEqual(denied.status_code, 403)

        self.client.force_authenticate(self.other)
        updated = self.client.patch(
            f"/api/community/communities/{community.id}/",
            {"name": "Updated page", "description": "Updated description"},
            format="json",
        )

        self.assertEqual(updated.status_code, 200)
        community.refresh_from_db()
        self.assertEqual(community.name, "Updated page")
        self.assertEqual(community.description, "Updated description")

    def test_public_group_join_and_private_group_is_not_joinable(self):
        public_group = Community.objects.create(
            owner=self.other,
            name="Public group",
            kind=Community.Kind.GROUP,
        )
        private_group = Community.objects.create(
            owner=self.other,
            name="Private group",
            kind=Community.Kind.GROUP,
            visibility=Community.Visibility.PRIVATE,
        )

        joined = self.client.post(
            f"/api/community/communities/{public_group.id}/membership/"
        )
        denied = self.client.post(
            f"/api/community/communities/{private_group.id}/membership/"
        )

        self.assertEqual(joined.status_code, 201)
        self.assertTrue(
            CommunityMembership.objects.filter(
                community=public_group,
                user=self.user,
            ).exists()
        )
        public_group.refresh_from_db()
        self.assertTrue(
            public_group.conversation.participants.filter(pk=self.user.pk).exists()
        )
        self.assertEqual(denied.status_code, 403)

    def test_community_admin_can_list_and_remove_members_from_group_chat(self):
        community = Community.objects.create(
            owner=self.other,
            name="Managed group",
            kind=Community.Kind.GROUP,
        )
        CommunityMembership.objects.create(
            community=community,
            user=self.other,
            role=CommunityMembership.Role.ADMIN,
        )
        CommunityMembership.objects.create(
            community=community,
            user=self.user,
        )
        conversation = Conversation.objects.create(
            conversation_type=Conversation.ConversationType.GROUP,
            created_by=self.other,
        )
        community.conversation = conversation
        community.save(update_fields=["conversation"])
        conversation.participants.add(self.other, self.user)
        ConversationMember.objects.create(
            conversation=conversation,
            user=self.other,
            role=ConversationMember.Role.ADMIN,
        )
        ConversationMember.objects.create(
            conversation=conversation,
            user=self.user,
        )
        members_url = f"/api/community/communities/{community.id}/members/"

        self.client.force_authenticate(self.user)
        denied_list = self.client.get(members_url)
        denied_remove = self.client.delete(f"{members_url}{self.user.id}/")
        self.assertEqual(denied_list.status_code, 403)
        self.assertEqual(denied_remove.status_code, 403)

        self.client.force_authenticate(self.other)
        members = self.client.get(members_url)
        self.assertEqual(members.status_code, 200)
        self.assertEqual(
            {item["user_id"] for item in members.data},
            {self.other.id, self.user.id},
        )
        self.assertEqual(
            next(item for item in members.data if item["user_id"] == self.user.id)["role"],
            CommunityMembership.Role.MEMBER,
        )

        removed = self.client.delete(f"{members_url}{self.user.id}/")
        self.assertEqual(removed.status_code, 204)
        self.assertFalse(
            CommunityMembership.objects.filter(
                community=community,
                user=self.user,
            ).exists()
        )
        self.assertFalse(conversation.participants.filter(pk=self.user.pk).exists())
        self.assertFalse(
            ConversationMember.objects.filter(
                conversation=conversation,
                user=self.user,
            ).exists()
        )

    def test_community_admin_cannot_remove_another_admin_or_the_owner(self):
        community = Community.objects.create(
            owner=self.other,
            name="Protected admins",
            kind=Community.Kind.GROUP,
        )
        CommunityMembership.objects.create(
            community=community,
            user=self.other,
            role=CommunityMembership.Role.ADMIN,
        )
        CommunityMembership.objects.create(
            community=community,
            user=self.user,
            role=CommunityMembership.Role.ADMIN,
        )
        members_url = f"/api/community/communities/{community.id}/members/"

        owner_removal = self.client.delete(f"{members_url}{self.other.id}/")
        third_admin = User.objects.create_user(
            username="third-community-admin",
            email="third-admin@example.com",
            password="StrongPassword123",
        )
        CommunityMembership.objects.create(
            community=community,
            user=third_admin,
            role=CommunityMembership.Role.ADMIN,
        )
        other_admin_removal = self.client.delete(
            f"{members_url}{third_admin.id}/"
        )

        self.assertEqual(owner_removal.status_code, 400)
        self.assertEqual(other_admin_removal.status_code, 403)

    def test_creator_becomes_group_admin(self):
        response = self.client.post(
            "/api/community/communities/",
            {"name": "New community", "kind": Community.Kind.GROUP},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["membership_role"], "admin")
        self.assertEqual(response.data["member_count"], 1)
        community = Community.objects.get(pk=response.data["id"])
        self.assertIsNotNone(community.conversation_id)
        self.assertTrue(
            community.conversation.participants.filter(pk=self.user.pk).exists()
        )

    def test_event_attendance_can_be_changed_and_cancelled(self):
        event = Event.objects.create(
            host=self.other,
            title="Community meetup",
            starts_at=timezone.now() + timedelta(days=2),
        )

        going_response = self.client.post(
            f"/api/community/events/{event.id}/attendance/",
            {"response": "going"},
            format="json",
        )
        self.assertEqual(going_response.status_code, 400)

        response = self.client.post(
            f"/api/community/events/{event.id}/attendance/",
            {"response": Event.Response.INTERESTED},
            format="json",
        )
        changed = self.client.post(
            f"/api/community/events/{event.id}/attendance/",
            {"response": Event.Response.INTERESTED},
            format="json",
        )
        cancelled = self.client.delete(
            f"/api/community/events/{event.id}/attendance/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(changed.data["response"], Event.Response.INTERESTED)
        self.assertEqual(cancelled.status_code, 204)

    def test_event_host_can_view_interested_users_but_other_users_cannot(self):
        event = Event.objects.create(
            host=self.other,
            title="Community meetup",
            starts_at=timezone.now() + timedelta(days=2),
        )
        self.user.first_name = "Interested"
        self.user.last_name = "Member"
        self.user.save(update_fields=["first_name", "last_name"])
        EventAttendance.objects.create(
            event=event,
            user=self.user,
            response=Event.Response.INTERESTED,
        )
        endpoint = f"/api/community/events/{event.id}/interested-users/"

        forbidden = self.client.get(endpoint)
        self.assertEqual(forbidden.status_code, 403)

        self.client.force_authenticate(self.other)
        response = self.client.get(endpoint)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data,
            [{
                "id": self.user.id,
                "username": self.user.username,
                "full_name": "Interested Member",
                "avatar": None,
                "is_verified": False,
            }],
        )

    def test_authenticated_user_can_create_event_with_optional_fields_and_banner(self):
        image_buffer = BytesIO()
        Image.new("RGB", (2, 2), color="white").save(image_buffer, format="PNG")
        image_buffer.seek(0)
        banner = SimpleUploadedFile(
            "event.png",
            image_buffer.read(),
            content_type="image/png",
        )
        starts_at = timezone.now() + timedelta(days=2)
        ends_at = starts_at + timedelta(hours=2)

        response = self.client.post(
            "/api/community/events/",
            {
                "title": "Community harvest",
                "description": "Meet local growers",
                "location": "Town Hall",
                "starts_at": starts_at.isoformat(),
                "ends_at": ends_at.isoformat(),
                "banner": banner,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["host"]["id"], self.user.id)
        self.assertEqual(response.data["title"], "Community harvest")
        self.assertIsNotNone(response.data["ends_at"])
        self.assertTrue(response.data["banner"].startswith("http"))
        event = Event.objects.get(pk=response.data["id"])
        self.assertEqual(event.host, self.user)
        self.assertTrue(event.banner.name.startswith("events/"))

    def test_authenticated_user_can_create_event_without_banner_or_end_time(self):
        response = self.client.post(
            "/api/community/events/",
            {
                "title": "Simple meetup",
                "starts_at": (timezone.now() + timedelta(days=2)).isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["host"]["id"], self.user.id)
        self.assertIsNone(response.data["ends_at"])
        self.assertIsNone(response.data["banner"])

    def test_only_event_host_can_edit_or_delete_event(self):
        event = Event.objects.create(
            host=self.other,
            title="Original event",
            starts_at=timezone.now() + timedelta(days=3),
        )

        denied = self.client.patch(
            f"/api/community/events/{event.id}/",
            {"title": "Changed by non-host"},
            format="json",
        )
        self.assertEqual(denied.status_code, 403)

        self.client.force_authenticate(self.other)
        updated = self.client.patch(
            f"/api/community/events/{event.id}/",
            {"title": "Updated event"},
            format="json",
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data["title"], "Updated event")
        deleted = self.client.delete(f"/api/community/events/{event.id}/")
        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(Event.objects.filter(pk=event.id).exists())

    def test_event_deletion_removes_its_banner_from_storage(self):
        event = Event.objects.create(
            host=self.user,
            title="Event with banner",
            starts_at=timezone.now() + timedelta(days=3),
            banner="events/event-banner.png",
        )
        storage = event.banner.storage

        with patch.object(storage, "delete") as delete_file:
            with self.captureOnCommitCallbacks(execute=True):
                event.delete()

        delete_file.assert_called_once_with("events/event-banner.png")

    def test_replacing_event_banner_removes_previous_storage_file(self):
        event = Event.objects.create(
            host=self.user,
            title="Event with banner",
            starts_at=timezone.now() + timedelta(days=3),
            banner="events/old-banner.png",
        )
        storage = event.banner.storage
        event.banner = "events/new-banner.png"

        with patch.object(storage, "delete") as delete_file:
            with self.captureOnCommitCallbacks(execute=True):
                event.save(update_fields=["banner"])

        delete_file.assert_called_once_with("events/old-banner.png")

    def test_replacing_listing_image_removes_previous_storage_file(self):
        listing = MarketplaceListing.objects.create(
            seller=self.user,
            title="Item with image",
            price="100.00",
            image="marketplace_items/old-item.png",
        )
        storage = listing.image.storage
        listing.image = "marketplace_items/new-item.png"

        with patch.object(storage, "delete") as delete_file:
            with self.captureOnCommitCallbacks(execute=True):
                listing.save(update_fields=["image"])

        delete_file.assert_called_once_with("marketplace_items/old-item.png")

    def test_deleting_listing_removes_its_image_from_storage(self):
        listing = MarketplaceListing.objects.create(
            seller=self.user,
            title="Item with image",
            price="100.00",
            image="marketplace_items/item.png",
        )
        storage = listing.image.storage

        with patch.object(storage, "delete") as delete_file:
            with self.captureOnCommitCallbacks(execute=True):
                listing.delete()

        delete_file.assert_called_once_with("marketplace_items/item.png")

    def test_expired_event_cleanup_removes_banner_and_clears_field(self):
        event = Event.objects.create(
            host=self.user,
            title="Expired event",
            starts_at=timezone.now() - timedelta(days=2),
            ends_at=timezone.now() - timedelta(days=1),
            banner="events/expired-banner.png",
        )
        storage = event.banner.storage

        with patch.object(storage, "delete") as delete_file:
            cleaned_count = cleanup_expired_event_media()

        event.refresh_from_db()
        self.assertEqual(cleaned_count, 1)
        self.assertFalse(event.banner)
        delete_file.assert_called_once_with("events/expired-banner.png")

    def test_event_host_can_invite_friend_and_invitee_can_respond(self):
        from friendships.models import FriendRequest

        FriendRequest.objects.create(
            sender=self.user,
            receiver=self.other,
            status=FriendRequest.Status.ACCEPTED,
        )
        event = Event.objects.create(
            host=self.user,
            title="Friends event",
            starts_at=timezone.now() + timedelta(days=2),
        )
        invited = self.client.post(
            f"/api/community/events/{event.id}/invitations/",
            {"user_id": self.other.id},
            format="json",
        )
        self.assertEqual(invited.status_code, 201)

        self.client.force_authenticate(self.other)
        accepted = self.client.post(
            f"/api/community/event-invitations/{invited.data['id']}/respond/",
            {"response": EventInvitation.Status.ACCEPTED},
            format="json",
        )
        self.assertEqual(accepted.status_code, 200)
        self.assertEqual(accepted.data["status"], EventInvitation.Status.ACCEPTED)
        self.assertTrue(
            EventAttendance.objects.filter(
                event=event,
                user=self.other,
                response=Event.Response.INTERESTED,
            ).exists()
        )
        from notifications.models import Notification

        self.assertTrue(
            Notification.objects.filter(
                recipient=self.other,
                notification_type=Notification.NotificationType.EVENT_INVITATION,
            ).exists()
        )

    def test_event_invitation_notification_respects_preference(self):
        from friendships.models import FriendRequest
        from notifications.models import Notification, NotificationPreference

        FriendRequest.objects.create(
            sender=self.user,
            receiver=self.other,
            status=FriendRequest.Status.ACCEPTED,
        )
        NotificationPreference.objects.create(
            user=self.other,
            event_invitations=False,
        )
        event = Event.objects.create(
            host=self.user,
            title="Private invite",
            starts_at=timezone.now() + timedelta(days=2),
        )

        response = self.client.post(
            f"/api/community/events/{event.id}/invitations/",
            {"user_id": self.other.id},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertFalse(
            Notification.objects.filter(
                recipient=self.other,
                notification_type=Notification.NotificationType.EVENT_INVITATION,
            ).exists()
        )

    def test_marketplace_listing_is_owned_by_creator_and_searchable(self):
        created = self.client.post(
            "/api/community/marketplace/",
            {
                "title": "Rice cooker",
                "description": "Good condition",
                "price": "2500.00",
                "location": "Lahore",
            },
            format="multipart",
        )
        self.assertEqual(created.status_code, 201)
        listing_id = created.data["id"]

        self.client.force_authenticate(self.other)
        denied = self.client.patch(
            f"/api/community/marketplace/{listing_id}/",
            {"status": MarketplaceListing.Status.SOLD},
            format="json",
        )
        results = self.client.get("/api/community/marketplace/?q=cooker")

        self.assertEqual(denied.status_code, 403)
        self.assertEqual(results.status_code, 200)
        self.assertEqual(results.data["results"][0]["title"], "Rice cooker")

    def test_marketplace_listing_image_uses_marketplace_storage_path_and_public_url(self):
        image_buffer = BytesIO()
        Image.new("RGB", (2, 2), color="blue").save(image_buffer, format="PNG")
        image_buffer.seek(0)
        item_image = SimpleUploadedFile(
            "rice-cooker.png",
            image_buffer.read(),
            content_type="image/png",
        )

        response = self.client.post(
            "/api/community/marketplace/",
            {
                "title": "Rice cooker with photo",
                "price": "2500.00",
                "image": item_image,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(response.data["image"].startswith("http"))
        listing = MarketplaceListing.objects.get(pk=response.data["id"])
        self.assertTrue(listing.image.name.startswith("marketplace_items/"))

    def test_marketplace_listing_image_can_be_removed(self):
        listing = MarketplaceListing.objects.create(
            seller=self.user,
            title="Item to update",
            price="100.00",
            image="marketplace_items/remove-me.png",
        )

        response = self.client.patch(
            f"/api/community/marketplace/{listing.id}/",
            {"image": None},
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(response.data["image"])
        listing.refresh_from_db()
        self.assertFalse(listing.image)

    def test_marketplace_buyer_request_and_seller_acceptance(self):
        self.user.first_name = "Marketplace"
        self.user.last_name = "Buyer"
        self.user.is_verified = True
        self.user.save(update_fields=["first_name", "last_name", "is_verified"])
        listing = MarketplaceListing.objects.create(
            seller=self.other,
            title="Desk",
            price="1200.00",
        )
        requested = self.client.post(
            "/api/community/marketplace/orders/",
            {"listing": listing.id},
            format="json",
        )
        self.assertEqual(requested.status_code, 201)
        self.assertEqual(requested.data["status"], MarketplaceOrder.Status.REQUESTED)
        self.assertEqual(
            requested.data["buyer"],
            {
                "id": self.user.id,
                "username": self.user.username,
                "full_name": "Marketplace Buyer",
                "profile_picture": None,
                "is_verified": True,
            },
        )

        self.client.force_authenticate(self.other)
        seller_orders = self.client.get("/api/community/marketplace/orders/")
        self.assertEqual(seller_orders.status_code, 200)
        self.assertEqual(seller_orders.data["results"][0]["buyer"], requested.data["buyer"])
        accepted = self.client.patch(
            f"/api/community/marketplace/orders/{requested.data['id']}/",
            {"status": MarketplaceOrder.Status.ACCEPTED},
            format="json",
        )
        listing.refresh_from_db()
        self.assertEqual(accepted.status_code, 200)
        self.assertEqual(listing.status, MarketplaceListing.Status.SOLD)
        duplicate_accept = self.client.patch(
            f"/api/community/marketplace/orders/{requested.data['id']}/",
            {"status": MarketplaceOrder.Status.ACCEPTED},
            format="json",
        )
        self.assertEqual(duplicate_accept.status_code, 409)
