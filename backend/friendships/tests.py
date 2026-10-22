from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from friendships.models import FriendRequest


User = get_user_model()


class FriendRequestApiTests(APITestCase):
    def setUp(self):
        self.sender = User.objects.create_user(
            username="sender",
            email="sender@example.com",
            password="StrongPassword123",
        )
        self.receiver = User.objects.create_user(
            username="receiver",
            email="receiver@example.com",
            password="StrongPassword123",
        )

    def test_user_can_send_and_accept_friend_request(self):
        self.client.force_authenticate(user=self.sender)

        response = self.client.post(
            "/api/friends/requests/",
            {"user_id": self.receiver.id},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        request_id = response.data["id"]

        self.client.force_authenticate(user=self.receiver)
        response = self.client.get("/api/friends/requests/")

        self.assertEqual(response.status_code, 200)
        requests = response.data.get("results", response.data)
        self.assertEqual(len(requests), 1)
        self.assertEqual(requests[0]["id"], request_id)

        response = self.client.post(
            f"/api/friends/requests/{request_id}/respond/",
            {"action": "accept"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            FriendRequest.objects.get(pk=request_id).status,
            FriendRequest.Status.ACCEPTED,
        )

        response = self.client.get("/api/friends/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([friend["id"] for friend in response.data], [self.sender.id])
        self.assertEqual(response.data[0]["username"], self.sender.username)

    def test_friend_profile_lookup_uses_the_friend_id_from_the_list(self):
        FriendRequest.objects.create(
            sender=self.sender,
            receiver=self.receiver,
            status=FriendRequest.Status.ACCEPTED,
        )
        self.client.force_authenticate(user=self.receiver)

        friends_response = self.client.get("/api/friends/")
        friend_id = friends_response.data[0]["id"]
        profile_response = self.client.get(f"/api/users/{friend_id}/")

        self.assertEqual(friends_response.status_code, 200)
        self.assertEqual(friend_id, self.sender.id)
        self.assertEqual(profile_response.status_code, 200)
        self.assertEqual(profile_response.data["id"], self.sender.id)

    def test_friend_profile_lookup_returns_not_found_for_invalid_id(self):
        self.client.force_authenticate(user=self.sender)

        response = self.client.get("/api/users/99999999/")

        self.assertEqual(response.status_code, 404)

    def test_user_cannot_send_friend_request_to_themselves(self):
        self.client.force_authenticate(user=self.sender)

        response = self.client.post(
            "/api/friends/requests/",
            {"user_id": self.sender.id},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
