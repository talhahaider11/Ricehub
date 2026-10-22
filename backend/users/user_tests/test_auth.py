from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

User = get_user_model()


class AuthenticationTests(APITestCase):

    def test_register(self):
        response = self.client.post(
            "/api/users/register/",
            {
                "username": "alice",
                "email": "alice@example.com",
                "password": "StrongPassword123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)

        self.assertTrue(
            User.objects.filter(
                username="alice"
            ).exists()
        )

    def test_login(self):
        User.objects.create_user(
            username="alice",
            email="alice@example.com",
            password="StrongPassword123",
        )

        response = self.client.post(
            "/api/auth/login/",
            {
                "username": "alice",
                "password": "StrongPassword123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_invalid_login(self):
        User.objects.create_user(
            username="alice",
            password="StrongPassword123",
        )

        response = self.client.post(
            "/api/auth/login/",
            {
                "username": "alice",
                "password": "WrongPassword",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 401)
def test_unauthenticated_request(self):
    response = self.client.get(
        "/api/users/me/"
    )

    self.assertEqual(
        response.status_code,
        401,
    )

def test_refresh_token(self):
    User.objects.create_user(
        username="alice",
        password="StrongPassword123",
    )

    login = self.client.post(
        "/api/auth/login/",
        {
            "username": "alice",
            "password": "StrongPassword123",
        },
        format="json",
    )

    refresh = login.data["refresh"]

    response = self.client.post(
        "/api/auth/refresh/",
        {
            "refresh": refresh,
        },
        format="json",
    )

    self.assertEqual(response.status_code, 200)
    self.assertIn("access", response.data)

def test_update_profile(self):
    self.client.force_authenticate(
        user=self.user
    )

    response = self.client.patch(
        "/api/users/me/update/",
        {
            "first_name": "Alice",
            "last_name": "Johnson",
            "bio": "Hello RiceHub!",
        },
        format="json",
    )

    self.assertEqual(response.status_code, 200)

    self.user.refresh_from_db()

    self.assertEqual(
        self.user.first_name,
        "Alice",
    )