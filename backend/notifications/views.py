from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Notification, NotificationPreference
from .serializers import NotificationPreferenceSerializer, NotificationSerializer
from rest_framework import status
from .models import UserDevice
from .serializers import UserDeviceSerializer


class NotificationListView(
    generics.ListAPIView
):

    permission_classes = [
        IsAuthenticated
    ]

    serializer_class = NotificationSerializer

    def get_queryset(self):

        return (
            Notification.objects
            .filter(
                recipient=self.request.user
            )
            .select_related(
                "sender"
            )
            .order_by("-created_at")
        )


class MarkNotificationReadView(
    APIView
):

    permission_classes = [
        IsAuthenticated
    ]

    def post(self, request, pk):

        notification = (
            Notification.objects
            .filter(
                pk=pk,
                recipient=request.user,
            )
            .first()
        )

        if not notification:
            from rest_framework import status

            return Response(
                {
                    "detail": "Notification not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        notification.is_read = True
        notification.save(
            update_fields=["is_read"]
        )

        return Response(
            NotificationSerializer(
                notification,
                context={
                    "request": request
                },
            ).data
        )


class MarkAllNotificationsReadView(
    APIView
):

    permission_classes = [
        IsAuthenticated
    ]

    def post(self, request):

        (
            Notification.objects
            .filter(
                recipient=request.user,
                is_read=False,
            )
            .update(
                is_read=True
            )
        )

        return Response(
            {
                "message": "All notifications marked as read."
            }
        )



class RegisterDeviceView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = UserDeviceSerializer(
            data=request.data
        )

        serializer.is_valid(raise_exception=True)

        token = serializer.validated_data["token"]
        platform = serializer.validated_data["platform"]

        device, _ = UserDevice.objects.update_or_create(
            token=token,
            defaults={
                "user": request.user,
                "platform": platform,
            },
        )

        return Response(
            UserDeviceSerializer(device).data,
            status=status.HTTP_200_OK,
        )

    def delete(self, request):
        token = request.data.get("token")
        if not isinstance(token, str) or not token.strip():
            return Response(
                {"detail": "A push notification token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        UserDevice.objects.filter(
            user=request.user,
            token=token.strip(),
        ).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class NotificationPreferencesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        preferences, _ = NotificationPreference.objects.get_or_create(
            user=request.user
        )
        return Response(NotificationPreferenceSerializer(preferences).data)

    def patch(self, request):
        preferences, _ = NotificationPreference.objects.get_or_create(
            user=request.user
        )
        serializer = NotificationPreferenceSerializer(
            preferences,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)