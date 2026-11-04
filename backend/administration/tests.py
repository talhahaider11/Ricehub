from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import resolve
from rest_framework.test import APIClient

from moderation.models import AdminActionLog, ContentReport
from posts.models import Post
from friendships.models import FriendRequest

from .models import AdminActionLog as AdministrationActionLog
from .models import ContentReport as AdministrationContentReport
from .views import AdminDashboardView


User = get_user_model()


class AdministrationAppTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_administration_models_reuse_existing_moderation_tables(self):
        self.assertIs(AdministrationActionLog, AdminActionLog)
        self.assertIs(AdministrationContentReport, ContentReport)
        self.assertEqual(AdministrationActionLog._meta.app_label, "moderation")
        self.assertEqual(AdministrationContentReport._meta.app_label, "moderation")

    def test_dashboard_url_resolves_to_administration_view(self):
        self.assertIs(
            resolve("/api/admin/dashboard/").func.view_class,
            AdminDashboardView,
        )

    def test_dashboard_requires_staff_access(self):
        user = User.objects.create_user(
            username="regular-user",
            email="regular@example.com",
            password="Secure-test-password-123!",
        )
        self.client.force_authenticate(user)

        response = self.client.get("/api/admin/dashboard/")

        self.assertEqual(response.status_code, 403)

    def test_staff_user_receives_dashboard_statistics(self):
        user = User.objects.create_user(
            username="staff-user",
            email="staff@example.com",
            password="Secure-test-password-123!",
            is_staff=True,
        )
        self.client.force_authenticate(user)

        response = self.client.get("/api/admin/dashboard/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            set(response.data),
            {"users", "content", "messages", "reports"},
        )
        self.assertEqual(response.data["users"]["total"], 1)
        self.assertIn("comments", response.data["content"])

    def test_staff_can_filter_users_and_view_admin_details(self):
        staff_user = User.objects.create_user(
            username="staff-filter",
            email="staff-filter@example.com",
            password="Secure-test-password-123!",
            is_staff=True,
        )
        member = User.objects.create_user(
            username="member-filter",
            email="member-filter@example.com",
            password="Secure-test-password-123!",
        )
        Post.objects.create(author=member, content="Admin details post")
        FriendRequest.objects.create(
            sender=staff_user,
            receiver=member,
            status=FriendRequest.Status.ACCEPTED,
        )
        self.client.force_authenticate(staff_user)

        filtered = self.client.get("/api/admin/users/?staff=false&suspended=false")
        detail = self.client.get(f"/api/admin/users/{member.pk}/")

        self.assertEqual(filtered.status_code, 200)
        self.assertEqual(
            {item["id"] for item in filtered.data["results"]},
            {member.pk},
        )
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data["post_count"], 1)
        self.assertEqual(detail.data["friend_count"], 1)
        self.assertIn("last_login", detail.data)
        self.assertNotIn("password", detail.data)

    def test_staff_can_delete_user_and_action_is_audited(self):
        staff_user = User.objects.create_user(
            username="staff-delete",
            email="staff-delete@example.com",
            password="Secure-test-password-123!",
            is_staff=True,
        )
        member = User.objects.create_user(
            username="member-delete",
            email="member-delete@example.com",
            password="Secure-test-password-123!",
        )
        self.client.force_authenticate(staff_user)

        response = self.client.delete(
            f"/api/admin/users/{member.pk}/",
            {"reason": "Policy violation"},
            format="json",
        )

        self.assertEqual(response.status_code, 204)
        self.assertFalse(User.objects.filter(pk=member.pk).exists())
        action = AdminActionLog.objects.get(action="delete_user")
        self.assertEqual(action.actor, staff_user)
        self.assertEqual(action.target_id, member.pk)
        self.assertEqual(action.reason, "Policy violation")

    def test_admin_cannot_delete_self_or_superuser(self):
        staff_user = User.objects.create_user(
            username="staff-protected",
            email="staff-protected@example.com",
            password="Secure-test-password-123!",
            is_staff=True,
        )
        superuser = User.objects.create_superuser(
            username="root-protected",
            email="root-protected@example.com",
            password="Secure-test-password-123!",
        )
        self.client.force_authenticate(staff_user)

        self_response = self.client.delete(
            f"/api/admin/users/{staff_user.pk}/",
        )
        root_response = self.client.delete(
            f"/api/admin/users/{superuser.pk}/",
        )

        self.assertEqual(self_response.status_code, 400)
        self.assertEqual(root_response.status_code, 400)
        self.assertTrue(User.objects.filter(pk=staff_user.pk).exists())
        self.assertTrue(User.objects.filter(pk=superuser.pk).exists())
