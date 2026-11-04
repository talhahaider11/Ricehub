from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from community.models import Community, Story
from posts.models import Post
from users.models import AccountReport, MutedUser, SupportRequest


User = get_user_model()


class ProfileActionTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="profile-owner",
            email="owner@example.com",
            password="StrongPassword123",
        )
        self.other = User.objects.create_user(
            username="profile-other",
            email="other@example.com",
            password="StrongPassword123",
        )
        self.client.force_authenticate(self.user)

    def test_mute_hides_account_posts_and_stories_from_home(self):
        Post.objects.create(author=self.user, content="My private profile post", visibility="private")
        Post.objects.create(author=self.other, content="Muted public post", visibility="public")
        own_story = Story.objects.create(author=self.user, text="My story")
        Story.objects.create(author=self.other, text="Muted story")

        muted = self.client.post(f"/api/users/muted-users/{self.other.pk}/")
        self.assertEqual(muted.status_code, status.HTTP_201_CREATED)
        self.assertTrue(MutedUser.objects.filter(muter=self.user, muted=self.other).exists())

        posts = self.client.get("/api/posts/")
        stories = self.client.get("/api/community/stories/")
        self.assertEqual(posts.status_code, status.HTTP_200_OK)
        self.assertEqual(stories.status_code, status.HTTP_200_OK)
        self.assertEqual(posts.data["results"], [])
        self.assertEqual(
            [story["id"] for story in stories.data["results"]],
            [own_story.pk],
        )

    def test_own_private_posts_are_available_from_profile_query_only(self):
        Post.objects.create(author=self.user, content="Profile-only post", visibility="private")

        home = self.client.get("/api/posts/")
        profile = self.client.get(f"/api/posts/?author={self.user.pk}")

        self.assertEqual(home.data["results"], [])
        self.assertEqual(len(profile.data["results"]), 1)
        self.assertEqual(profile.data["results"][0]["content"], "Profile-only post")

    def test_profile_report_and_support_requests_are_stored(self):
        report = self.client.post(
            "/api/users/reports/accounts/",
            {"user_id": self.other.pk, "reason": "harassment", "details": "Repeated abuse"},
            format="json",
        )
        support = self.client.post(
            "/api/users/support/requests/",
            {"subject": "Search issue", "details": "Search results are not appearing."},
            format="json",
        )

        self.assertEqual(report.status_code, status.HTTP_201_CREATED)
        self.assertEqual(support.status_code, status.HTTP_201_CREATED)
        self.assertTrue(AccountReport.objects.filter(reporter=self.user, reported_user=self.other).exists())
        self.assertTrue(SupportRequest.objects.filter(reporter=self.user, subject="Search issue").exists())

    def test_global_search_returns_matching_people_posts_and_groups(self):
        matching_user = User.objects.create_user(
            username="rice-farmer",
            email="farmer@example.com",
            password="StrongPassword123",
        )
        Post.objects.create(
            author=matching_user,
            content="Rice market update",
            visibility=Post.Visibility.PUBLIC,
        )
        Community.objects.create(
            owner=matching_user,
            name="Rice growers",
            description="A public rice group",
            kind=Community.Kind.GROUP,
            visibility=Community.Visibility.PUBLIC,
        )

        response = self.client.get("/api/search/", {"q": "rice"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["username"] for item in response.data["users"]], ["rice-farmer"])
        self.assertEqual(response.data["posts"][0]["content"], "Rice market update")
        self.assertEqual(response.data["posts"][0]["author"]["username"], "rice-farmer")
        self.assertEqual(response.data["groups"][0]["name"], "Rice growers")

    def test_users_cannot_mute_or_report_themselves(self):
        mute = self.client.post(f"/api/users/muted-users/{self.user.pk}/")
        report = self.client.post(
            "/api/users/reports/accounts/",
            {"user_id": self.user.pk, "reason": "other"},
            format="json",
        )

        self.assertEqual(mute.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(report.status_code, status.HTTP_400_BAD_REQUEST)
