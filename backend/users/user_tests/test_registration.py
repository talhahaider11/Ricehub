from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status

from users.models import EmailVerification

User = get_user_model()


class RegistrationTests(APITestCase):

    def test_user_can_register(self):
        response = self.client.post(
            "/api/users/register/",
            {
                "username": "john",
                "email": "john@example.com",
                "first_name": "John",
                "last_name": "Doe",
                "password": "StrongPassword123",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        self.assertTrue(
            User.objects.filter(
                username="john"
            ).exists()
        )
        user = User.objects.get(username="john")
        self.assertTrue(user.is_active)
        self.assertFalse(user.is_email_verified)
        self.assertFalse(EmailVerification.objects.filter(user=user).exists())

        login = self.client.post(
            "/api/token/",
            {"username": "john", "password": "StrongPassword123"},
            format="json",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        self.assertIn("access", login.data)

    def test_weak_password_rejected(self):
        response = self.client.post(
            "/api/users/register/",
            {
                "username": "john",
                "email": "john@example.com",
                "password": "123",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_username_availability_suggests_alternatives_case_insensitively(self):
        User.objects.create_user(
            username="john",
            email="existing@example.com",
            password="StrongPassword123",
        )

        response = self.client.get(
            "/api/users/username-availability/",
            {"username": "John"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["available"])
        self.assertEqual(response.data["suggestions"], ["John1", "John2", "John3"])

    def test_registration_rejects_case_insensitive_duplicate_username(self):
        User.objects.create_user(
            username="john",
            email="existing@example.com",
            password="StrongPassword123",
        )

        response = self.client.post(
            "/api/users/register/",
            {
                "username": "John",
                "email": "john.new@example.com",
                "password": "StrongPassword123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email="john.new@example.com").exists())