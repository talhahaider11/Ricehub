from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import FriendRequest
from .serializers import (FriendRequestSerializer,FriendUserSerializer,)
from notifications.models import Notification
from notifications.services import create_notification
from users.privacy import can_receive_friend_request


User = get_user_model()
class FriendRequestListCreateView(
    generics.ListCreateAPIView
):
    permission_classes = [
        IsAuthenticated
    ]
    serializer_class = FriendRequestSerializer
    def get_queryset(self):
        return (
            FriendRequest.objects
            .filter(
                receiver=self.request.user,
                status=FriendRequest.Status.PENDING,
            )
            .select_related(
                "sender",
                "receiver",
            )
        )

    def post(self, request, *args, **kwargs):
        user_id = request.data.get("user_id")
        username = request.data.get("username")
        if not user_id and not username:
            return Response(
                {
                    "detail": "Username or user ID is required."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            if user_id:
                receiver = User.objects.get(pk=user_id)
            else:
                receiver = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response(
                {
                    "detail": "User not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        if receiver == request.user:
            return Response(
                {
                    "detail": "You cannot add yourself."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not can_receive_friend_request(request.user, receiver):
            return Response(
                {"detail": "This person is not accepting friend requests from you."},
                status=status.HTTP_403_FORBIDDEN,
            )
        existing = (
            FriendRequest.objects
            .filter(
                Q(
                    sender=request.user,
                    receiver=receiver,
                )
                | Q(
                    sender=receiver,
                    receiver=request.user,
                )
            )
            .first()
        )
        if existing:
            return Response(
                {
                    "detail": "A friend request already exists."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        friend_request = (
            FriendRequest.objects.create(
                sender=request.user,
                receiver=receiver,
            )
        )
        create_notification(
            recipient=receiver,
            sender=request.user,
            notification_type=Notification.NotificationType.FRIEND_REQUEST,
            message=f"{request.user.username} sent you a friend request.",
        )
        return Response(
            FriendRequestSerializer(
                friend_request,
                context={
                    "request": request
                },
            ).data,
            status=status.HTTP_201_CREATED,
        )
class FriendRequestActionView(APIView):

    permission_classes = [
        IsAuthenticated
    ]

    def post(self, request, pk, action=None):

        if action is None:
            action = request.data.get("action")

        try:
            friend_request = (
                FriendRequest.objects.get(
                    pk=pk
                )
            )
        except FriendRequest.DoesNotExist:
            return Response(
                {
                    "detail": "Friend request not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        if (
            friend_request.receiver
            != request.user
        ):
            return Response(
                {
                    "detail": "You cannot modify this request."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if (
            friend_request.status
            != FriendRequest.Status.PENDING
        ):
            return Response(
                {
                    "detail": "Request is no longer pending."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        
        if action == "accept":

            friend_request.status = (
                FriendRequest.Status.ACCEPTED
            )

            friend_request.save()

            create_notification(
                recipient=friend_request.sender,
                sender=request.user,
                notification_type=Notification.NotificationType.FRIEND_ACCEPTED,
                message=f"{request.user.username} accepted your friend request.",
            )


        elif action == "reject":

            friend_request.status = (
                FriendRequest.Status.REJECTED
            )

        else:
            return Response(
                {
                    "detail": "Invalid action."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        friend_request.save()

        return Response(
            FriendRequestSerializer(
                friend_request,
                context={
                    "request": request
                },
            ).data
        )


class FriendListView(APIView):

    permission_classes = [
        IsAuthenticated
    ]

    def get(self, request):

        accepted = FriendRequest.objects.filter(
            status=FriendRequest.Status.ACCEPTED
        ).filter(
            Q(sender=request.user)
            | Q(receiver=request.user)
        )

        friend_ids = set()

        for item in accepted:

            if item.sender_id == request.user.id:
                friend_ids.add(
                    item.receiver_id
                )
            else:
                friend_ids.add(
                    item.sender_id
                )

        friends = User.objects.filter(
            id__in=friend_ids
        )
        serializer = FriendUserSerializer(
            friends,
            many=True,
            context={
                "request": request
            },
        )
        return Response(
            serializer.data
        )