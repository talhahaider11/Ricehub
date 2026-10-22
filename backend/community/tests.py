from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import (
    Community,
    CommunityMembership,
    CommunityPost,
    Event,
    EventAttendance,
    EventInvitation,
    MarketplaceListing,
    MarketplaceOrder,
    Story,
    StoryView,
)


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
        active_story = Story.objects.create(author=self.user, text="Still here")
        Story.objects.create(
            author=self.other,
            text="Expired",
            expires_at=timezone.now() - timedelta(seconds=1),
        )

        response = self.client.get("/api/community/stories/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.data["results"]], [active_story.id])

    def test_story_owner_can_see_viewers_and_viewer_is_counted_once(self):
        story = Story.objects.create(author=self.other, text="Story")
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

    def test_only_members_can_post_or_read_group_posts_and_admin_can_moderate(self):
        group = Community.objects.create(
            owner=self.other,
            name="Members only",
            kind=Community.Kind.GROUP,
        )
        CommunityMembership.objects.create(
            community=group,
            user=self.other,
            role=CommunityMembership.Role.ADMIN,
        )
        posts_url = f"/api/community/communities/{group.id}/posts/"
        denied = self.client.post(
            posts_url,
            {"content": "Not joined"},
            format="json",
        )
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
        self.assertEqual(denied.status_code, 403)

    def test_creator_becomes_group_admin(self):
        response = self.client.post(
            "/api/community/communities/",
            {"name": "New community", "kind": Community.Kind.GROUP},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["membership_role"], "admin")
        self.assertEqual(response.data["member_count"], 1)

    def test_event_attendance_can_be_changed_and_cancelled(self):
        event = Event.objects.create(
            host=self.other,
            title="Community meetup",
            starts_at=timezone.now() + timedelta(days=2),
        )

        response = self.client.post(
            f"/api/community/events/{event.id}/attendance/",
            {"response": Event.Response.GOING},
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
            EventAttendance.objects.filter(event=event, user=self.other).exists()
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

    def test_marketplace_buyer_request_and_seller_acceptance(self):
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

        self.client.force_authenticate(self.other)
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
