from datetime import timedelta

from django.contrib.auth import get_user_model
from django.conf import settings
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase

from friendships.models import FriendRequest
from media_app.models import MediaAsset
from users.models import BlockedUser, ProfileVisibility

from .models import Story, StoryView


User = get_user_model()


class StoryAPITests(APITestCase):
    def setUp(self):
        self.viewer = User.objects.create_user(
            username="story-viewer",
            email="story-viewer@example.com",
            password="test-password",
        )
        self.author = User.objects.create_user(
            username="story-author",
            email="story-author@example.com",
            password="test-password",
        )
        self.client.force_authenticate(self.viewer)

    def test_list_returns_own_and_visible_unexpired_stories(self):
        own_story = Story.objects.create(author=self.viewer, text="Mine")
        public_story = Story.objects.create(
            author=self.author,
            text="Public",
            visibility=Story.Visibility.PUBLIC,
        )
        expired_story = Story.objects.create(
            author=self.author,
            text="Expired",
            visibility=Story.Visibility.PUBLIC,
            expires_at=timezone.now() - timedelta(seconds=1),
        )

        response = self.client.get("/api/stories/")

        self.assertEqual(response.status_code, 200)
        story_ids = {story["id"] for story in response.data["results"]}
        self.assertEqual(story_ids, {own_story.pk, public_story.pk})
        self.assertNotIn(expired_story.pk, story_ids)

    def test_expired_story_cleanup_runs_hourly_from_celery_beat(self):
        schedule = settings.CELERY_BEAT_SCHEDULE["delete-expired-stories-hourly"]

        self.assertEqual(
            schedule["task"],
            "stories.tasks.delete_expired_stories",
        )
        self.assertEqual(schedule["schedule"], 3600.0)

    def test_friends_only_story_is_visible_to_accepted_friend(self):
        FriendRequest.objects.create(
            sender=self.viewer,
            receiver=self.author,
            status=FriendRequest.Status.ACCEPTED,
        )
        story = Story.objects.create(author=self.author, text="Friends")

        response = self.client.get("/api/stories/")

        self.assertIn(
            story.pk,
            {item["id"] for item in response.data["results"]},
        )

    def test_public_story_respects_private_profile_visibility(self):
        self.author.profile_visibility = ProfileVisibility.PRIVATE
        self.author.save(update_fields=["profile_visibility"])
        story = Story.objects.create(
            author=self.author,
            text="Private profile",
            visibility=Story.Visibility.PUBLIC,
        )

        response = self.client.get("/api/stories/")

        self.assertNotIn(
            story.pk,
            {item["id"] for item in response.data["results"]},
        )

    def test_blocking_either_direction_hides_story(self):
        story = Story.objects.create(
            author=self.author,
            text="Blocked",
            visibility=Story.Visibility.PUBLIC,
        )
        BlockedUser.objects.create(blocker=self.author, blocked=self.viewer)

        response = self.client.get("/api/stories/")

        self.assertNotIn(
            story.pk,
            {item["id"] for item in response.data["results"]},
        )

    def test_story_owner_blocking_viewer_denies_story_detail(self):
        story = Story.objects.create(
            author=self.author,
            text="Blocked detail",
            visibility=Story.Visibility.PUBLIC,
        )
        BlockedUser.objects.create(blocker=self.viewer, blocked=self.author)

        response = self.client.get(f"/api/stories/{story.pk}/")

        self.assertEqual(response.status_code, 403)

    def test_inactive_and_suspended_story_owners_are_hidden(self):
        story = Story.objects.create(
            author=self.author,
            text="Not visible",
            visibility=Story.Visibility.PUBLIC,
        )
        self.author.is_suspended = True
        self.author.save(update_fields=["is_suspended"])

        response = self.client.get("/api/stories/")

        self.assertNotIn(
            story.pk,
            {item["id"] for item in response.data["results"]},
        )

        self.author.is_suspended = False
        self.author.is_active = False
        self.author.save(update_fields=["is_suspended", "is_active"])

        response = self.client.get(f"/api/stories/{story.pk}/")
        self.assertEqual(response.status_code, 403)

    def test_suspended_user_cannot_create_story(self):
        self.viewer.is_suspended = True
        self.viewer.save(update_fields=["is_suspended"])

        response = self.client.post(
            "/api/stories/",
            {"caption": "Suspended"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(Story.objects.filter(author=self.viewer).exists())

    def test_expired_story_cannot_be_opened(self):
        story = Story.objects.create(
            author=self.author,
            text="Expired",
            visibility=Story.Visibility.PUBLIC,
            expires_at=timezone.now() - timedelta(seconds=1),
        )

        response = self.client.get(f"/api/stories/{story.pk}/")

        self.assertEqual(response.status_code, 404)

    def test_create_requires_text_or_media(self):
        response = self.client.post(
            "/api/stories/",
            {"caption": "   "},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Story.objects.filter(author=self.viewer).exists())

    def test_story_upload_rejects_direct_files_that_bypass_media_api(self):
        response = self.client.post(
            "/api/stories/create/",
            {
                "image": SimpleUploadedFile(
                    "photo.png",
                    b"not-an-image",
                    content_type="image/png",
                ),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Story.objects.filter(author=self.viewer).exists())

    def test_create_and_mark_viewed_once(self):
        created = self.client.post(
            "/api/stories/",
            {"caption": "A story"},
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data["caption"], "A story")
        self.assertEqual(created.data["author"]["id"], self.viewer.pk)
        self.assertEqual(created.data["author"]["username"], self.viewer.username)
        self.assertIn("avatar", created.data["author"])

        story = Story.objects.create(
            author=self.author,
            text="A public story",
            visibility=Story.Visibility.PUBLIC,
        )
        view_url = f"/api/stories/{story.pk}/view/"
        first_view = self.client.post(view_url)
        second_view = self.client.post(view_url)

        self.assertEqual(first_view.status_code, 200)
        self.assertEqual(second_view.status_code, 200)
        self.assertEqual(
            StoryView.objects.filter(story=story, viewer=self.viewer).count(),
            1,
        )

    def test_only_owner_can_delete_or_list_viewers(self):
        story = Story.objects.create(author=self.author, text="Owner only")

        delete_response = self.client.delete(
            f"/api/stories/{story.pk}/delete/",
        )
        viewers_response = self.client.get(
            f"/api/stories/{story.pk}/viewers/",
        )

        self.assertEqual(delete_response.status_code, 404)
        self.assertEqual(viewers_response.status_code, 404)
        self.assertTrue(Story.all_objects.filter(pk=story.pk).exists())

    def test_owner_can_delete_story_without_deleting_its_media_asset(self):
        asset = MediaAsset.objects.create(
            owner=self.author,
            media_type=MediaAsset.MediaType.IMAGE,
            file="media/owned.jpg",
            processing_status=MediaAsset.ProcessingStatus.READY,
        )
        story = Story.objects.create(
            author=self.author,
            text="Owned story",
            media_asset=asset,
        )
        self.client.force_authenticate(self.author)

        response = self.client.delete(f"/api/stories/{story.pk}/delete/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Story.all_objects.filter(pk=story.pk).exists())
        self.assertTrue(MediaAsset.objects.filter(pk=asset.pk).exists())

    def test_active_story_limit_is_enforced(self):
        Story.objects.bulk_create(
            [
                Story(author=self.viewer, text=f"Story {index}")
                for index in range(100)
            ]
        )

        response = self.client.post(
            "/api/stories/",
            {"caption": "Over limit"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            Story.objects.active().filter(author=self.viewer).count(),
            100,
        )

    def test_create_story_reuses_only_owned_ready_media_assets(self):
        image = MediaAsset.objects.create(
            owner=self.viewer,
            media_type=MediaAsset.MediaType.IMAGE,
            file="media/test.jpg",
            processing_status=MediaAsset.ProcessingStatus.READY,
        )
        response = self.client.post(
            "/api/stories/create/",
            {"media_id": image.pk, "visibility": "friends"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        story = Story.objects.get(pk=response.data["id"])
        self.assertEqual(story.media_asset_id, image.pk)
        self.assertEqual(response.data["media_type"], "image")
        self.assertTrue(response.data["media_url"].endswith("media/test.jpg"))
        self.assertIn("thumbnail_url", response.data)

    def test_create_story_rejects_another_users_media_asset(self):
        image = MediaAsset.objects.create(
            owner=self.author,
            media_type=MediaAsset.MediaType.IMAGE,
            file="media/other.jpg",
            processing_status=MediaAsset.ProcessingStatus.READY,
        )

        response = self.client.post(
            "/api/stories/create/",
            {"media_id": image.pk},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Story.objects.filter(author=self.viewer).exists())

    def test_create_story_rejects_media_that_is_not_ready(self):
        video = MediaAsset.objects.create(
            owner=self.viewer,
            media_type=MediaAsset.MediaType.VIDEO,
            file="media/pending.mp4",
            processing_status=MediaAsset.ProcessingStatus.PENDING,
        )

        response = self.client.post(
            "/api/stories/create/",
            {"media_id": video.pk},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Story.objects.filter(author=self.viewer).exists())

    def test_expired_story_task_keeps_referenced_media_asset(self):
        image = MediaAsset.objects.create(
            owner=self.viewer,
            media_type=MediaAsset.MediaType.IMAGE,
            file="media/expired.jpg",
            processing_status=MediaAsset.ProcessingStatus.READY,
        )
        expired_story = Story.all_objects.create(
            author=self.viewer,
            text="Expired",
            media_asset=image,
            expires_at=timezone.now() - timedelta(seconds=1),
        )
        StoryView.objects.create(story=expired_story, viewer=self.author)

        from .tasks import delete_expired_stories

        deleted_count = delete_expired_stories.run()

        self.assertEqual(deleted_count, 1)
        self.assertTrue(MediaAsset.objects.filter(pk=image.pk).exists())
        self.assertFalse(Story.all_objects.filter(text="Expired").exists())
        self.assertFalse(StoryView.objects.filter(story=expired_story).exists())
