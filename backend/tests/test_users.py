from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

User = get_user_model()


class UserTests(APITestCase):

    def test_register_user(self):
        response = self.client.post(
            "/api/users/register/",
            {
                "username": "john",
                "email": "john@example.com",
                "password": "StrongPassword123!",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            201,
        )

        self.assertTrue(
            User.objects.filter(
                username="john"
            ).exists()
        )