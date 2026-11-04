from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APITestCase

from comments.models import Comment
from posts.models import Post
from users.models import AccountReport, BlockedUser
from users.privacy import get_blocked_user_ids

from .models import AdminActionLog, ContentReport


User = get_user_model()


class ContentReportApiTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.reporter = User.objects.create_user(
            username="reporter",
            email="reporter@example.com",
            password="test-password",
        )
        self.author = User.objects.create_user(
            username="author",
            email="author@example.com",
            password="test-password",
        )
        self.post = Post.objects.create(author=self.author, content="Reported post")
        self.comment = Comment.objects.create(
            post=self.post,
            author=self.author,
            content="Reported comment",
        )

    def tearDown(self):
        cache.clear()

    def test_authenticated_user_can_report_a_post_and_comment(self):
        self.client.force_authenticate(self.reporter)

        post_response = self.client.post(
            "/api/moderation/content-reports/",
            {"target_type": "post", "target_id": self.post.pk, "reason": "spam"},
            format="json",
        )
        comment_response = self.client.post(
            "/api/moderation/content-reports/",
            {
                "target_type": "comment",
                "target_id": self.comment.pk,
                "reason": "harassment",
                "details": "Please review this comment.",
            },
            format="json",
        )

        self.assertEqual(post_response.status_code, 201)
        self.assertEqual(comment_response.status_code, 201)
        self.assertEqual(ContentReport.objects.count(), 2)
        self.assertEqual(
            ContentReport.objects.get(target_type="comment").target_text,
            "Reported comment",
        )

    def test_user_cannot_report_own_content_or_duplicate_a_report(self):
        own_post = Post.objects.create(author=self.reporter, content="Mine")
        self.client.force_authenticate(self.reporter)

        own_response = self.client.post(
            "/api/moderation/content-reports/",
            {"target_type": "post", "target_id": own_post.pk, "reason": "spam"},
            format="json",
        )
        first_response = self.client.post(
            "/api/moderation/content-reports/",
            {"target_type": "post", "target_id": self.post.pk, "reason": "spam"},
            format="json",
        )
        duplicate_response = self.client.post(
            "/api/moderation/content-reports/",
            {"target_type": "post", "target_id": self.post.pk, "reason": "spam"},
            format="json",
        )

        self.assertEqual(own_response.status_code, 400)
        self.assertEqual(first_response.status_code, 201)
        self.assertEqual(duplicate_response.status_code, 400)
        self.assertEqual(ContentReport.objects.count(), 1)

    def test_user_cannot_report_private_or_blocked_content(self):
        private_post = Post.objects.create(
            author=self.author,
            content="Private post",
            visibility=Post.Visibility.PRIVATE,
        )
        self.client.force_authenticate(self.reporter)

        private_response = self.client.post(
            "/api/moderation/content-reports/",
            {
                "target_type": "post",
                "target_id": private_post.pk,
                "reason": "spam",
            },
            format="json",
        )
        BlockedUser.objects.create(blocker=self.reporter, blocked=self.author)
        blocked_response = self.client.post(
            "/api/moderation/content-reports/",
            {
                "target_type": "post",
                "target_id": self.post.pk,
                "reason": "spam",
            },
            format="json",
        )

        self.assertEqual(private_response.status_code, 400)
        self.assertEqual(blocked_response.status_code, 400)
        self.assertEqual(ContentReport.objects.count(), 0)

    def test_content_report_queue_and_triage_are_staff_only(self):
        report = ContentReport.objects.create(
            reporter=self.reporter,
            target_type=ContentReport.TargetType.POST,
            target_id=self.post.pk,
            post=self.post,
            target_author=self.author,
            target_text=self.post.content,
            reason=ContentReport.Reason.SPAM,
        )
        self.client.force_authenticate(self.reporter)

        denied = self.client.get("/api/moderation/admin/reports/")
        self.assertEqual(denied.status_code, 403)

        staff_user = User.objects.create_user(
            username="moderator",
            email="moderator@example.com",
            password="test-password",
            is_staff=True,
        )
        self.client.force_authenticate(staff_user)
        listed = self.client.get("/api/moderation/admin/reports/?status=open")
        updated = self.client.patch(
            f"/api/moderation/admin/reports/{report.pk}/",
            {"status": "dismissed", "resolution_note": "Reviewed."},
            format="json",
        )
        overview = self.client.get("/api/moderation/admin/overview/")

        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.data["results"][0]["id"], report.pk)
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data["reviewed_by_username"], staff_user.username)
        self.assertEqual(overview.status_code, 200)
        self.assertEqual(overview.data["open_content_reports"], 0)

    def test_moderation_block_routes_share_account_blocking_state(self):
        self.client.force_authenticate(self.reporter)
        block_url = f"/api/moderation/users/{self.author.pk}/block/"

        created = self.client.post(block_url)
        repeated = self.client.post(block_url)
        listed = self.client.get("/api/moderation/blocks/")

        self.assertEqual(created.status_code, 201)
        self.assertEqual(repeated.status_code, 200)
        self.assertEqual(listed.data[0]["id"], self.author.pk)
        self.assertIn(self.author.pk, get_blocked_user_ids(self.reporter))
        self.assertTrue(
            BlockedUser.objects.filter(
                blocker=self.reporter,
                blocked=self.author,
            ).exists()
        )

        unblocked = self.client.delete(block_url)
        self.assertEqual(unblocked.status_code, 204)
        self.assertNotIn(self.author.pk, get_blocked_user_ids(self.reporter))

    def test_user_cannot_block_themselves(self):
        self.client.force_authenticate(self.reporter)

        response = self.client.post(
            f"/api/moderation/users/{self.reporter.pk}/block/"
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(
            BlockedUser.objects.filter(
                blocker=self.reporter,
                blocked=self.reporter,
            ).exists()
        )

    def test_staff_can_suspend_and_restore_account_authentication(self):
        self.author.set_password("Secure-test-password-2026!")
        self.author.save(update_fields=["password"])
        staff_user = User.objects.create_user(
            username="staff-suspension",
            email="staff-suspension@example.com",
            password="Secure-test-password-2026!",
            is_staff=True,
        )
        self.client.force_authenticate(staff_user)
        suspend_url = f"/api/admin/users/{self.author.pk}/suspend/"

        suspended = self.client.post(
            suspend_url,
            {"reason": "Repeated abusive content"},
            format="json",
        )
        self.author.refresh_from_db()
        self.assertEqual(suspended.status_code, 200)
        self.assertTrue(self.author.is_suspended)
        self.assertFalse(self.author.is_active)
        self.assertEqual(self.author.suspension_reason, "Repeated abusive content")

        self.client.force_authenticate(user=None)
        login = self.client.post(
            "/api/token/",
            {
                "username": self.author.username,
                "password": "Secure-test-password-2026!",
            },
            format="json",
        )
        self.assertEqual(login.status_code, 403)

        self.client.force_authenticate(staff_user)
        unsuspended = self.client.post(
            f"/api/admin/users/{self.author.pk}/unsuspend/"
        )
        self.author.refresh_from_db()
        self.assertEqual(unsuspended.status_code, 200)
        self.assertFalse(self.author.is_suspended)
        self.assertTrue(self.author.is_active)
        self.assertEqual(
            AdminActionLog.objects.filter(target_id=self.author.pk).count(),
            2,
        )

    def test_non_staff_cannot_suspend_users_or_review_account_reports(self):
        account_report = AccountReport.objects.create(
            reporter=self.reporter,
            reported_user=self.author,
            reason=AccountReport.Reason.SPAM,
            details="Repeated spam",
        )
        self.client.force_authenticate(self.reporter)

        suspended = self.client.post(
            f"/api/admin/users/{self.author.pk}/suspend/",
            {"reason": "Spam"},
            format="json",
        )
        reviewed = self.client.patch(
            f"/api/admin/account-reports/{account_report.pk}/",
            {"status": "reviewed"},
            format="json",
        )

        self.assertEqual(suspended.status_code, 403)
        self.assertEqual(reviewed.status_code, 403)
        self.author.refresh_from_db()
        self.assertTrue(self.author.is_active)

    def test_staff_can_review_account_reports_and_log_the_action(self):
        account_report = AccountReport.objects.create(
            reporter=self.reporter,
            reported_user=self.author,
            reason=AccountReport.Reason.HARASSMENT,
            details="Repeated abuse",
        )
        staff_user = User.objects.create_user(
            username="staff-account-reports",
            email="staff-account-reports@example.com",
            password="Secure-test-password-2026!",
            is_staff=True,
        )
        self.client.force_authenticate(staff_user)

        listed = self.client.get("/api/admin/account-reports/")
        reviewed = self.client.patch(
            f"/api/admin/account-reports/{account_report.pk}/",
            {
                "status": "reviewed",
                "moderator_notes": "Reviewed and actioned.",
            },
            format="json",
        )
        account_report.refresh_from_db()

        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.data["results"][0]["id"], account_report.pk)
        self.assertEqual(reviewed.status_code, 200)
        self.assertEqual(account_report.status, AccountReport.Status.REVIEWED)
        self.assertEqual(account_report.reviewed_by, staff_user)
        self.assertTrue(
            AdminActionLog.objects.filter(
                action="reviewed_account_report",
                target_id=account_report.pk,
            ).exists()
        )

    def test_staff_content_deletion_is_audited(self):
        staff_user = User.objects.create_user(
            username="staff-content-delete",
            email="staff-content-delete@example.com",
            password="Secure-test-password-2026!",
            is_staff=True,
        )
        self.client.force_authenticate(staff_user)

        response = self.client.delete(
            f"/api/admin/posts/{self.post.pk}/",
            {"reason": "Repeated policy violations"},
            format="json",
        )

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Post.objects.filter(pk=self.post.pk).exists())
        self.assertTrue(
            AdminActionLog.objects.filter(
                action="delete_post",
                target_type="post",
                reason="Repeated policy violations",
            ).exists()
        )

    def test_admin_user_listing_and_analytics_require_staff(self):
        self.client.force_authenticate(self.reporter)

        denied_users = self.client.get("/api/admin/users/")
        denied_analytics = self.client.get("/api/admin/analytics/users/")

        self.assertEqual(denied_users.status_code, 403)
        self.assertEqual(denied_analytics.status_code, 403)

        staff_user = User.objects.create_user(
            username="staff-analytics",
            email="staff-analytics@example.com",
            password="Secure-test-password-2026!",
            is_staff=True,
        )
        self.client.force_authenticate(staff_user)
        users = self.client.get("/api/admin/users/?status=all")
        analytics = self.client.get("/api/admin/analytics/users/?days=30")
        invalid_analytics = self.client.get("/api/admin/analytics/users/?days=366")

        self.assertEqual(users.status_code, 200)
        self.assertEqual(analytics.status_code, 200)
        self.assertEqual(analytics.data["days"], 30)
        self.assertEqual(invalid_analytics.status_code, 400)
