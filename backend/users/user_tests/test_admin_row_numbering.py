from django.contrib import admin
from django.contrib.auth import get_user_model
from django.test import RequestFactory, TestCase

from users.admin import CustomUserAdmin


User = get_user_model()


class UserAdminRowNumberingTests(TestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            username="admin",
            email="admin@example.com",
            password="test-password",
        )
        self.request_factory = RequestFactory()

    def test_user_numbers_recalculate_after_deletion_and_new_signup(self):
        users = [
            User.objects.create_user(
                username=f"member-{number}",
                email=f"member-{number}@example.com",
                password="test-password",
            )
            for number in range(1, 4)
        ]
        users[1].delete()
        newest = User.objects.create_user(
            username="member-new",
            email="member-new@example.com",
            password="test-password",
        )

        request = self.request_factory.get(
            "/admin/users/user/",
            {"is_staff__exact": "0"},
        )
        request.user = self.admin_user
        model_admin = CustomUserAdmin(User, admin.site)
        changelist = model_admin.get_changelist_instance(request)
        rows = list(changelist.result_list)

        self.assertEqual(
            [(row.username, row.admin_row_number) for row in rows],
            [
                ("member-1", 1),
                ("member-3", 2),
                (newest.username, 3),
            ],
        )
