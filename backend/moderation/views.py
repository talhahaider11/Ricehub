from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions

from .models import UserBlock
from .serializers import UserBlockSerializer

User = get_user_model()


class BlockUserView(APIView):
    """
    POST: Target user ko block karne ke liye.
    DELETE: Blocked user ko unblock karne ke liye.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, user_id):
        target = get_object_or_404(User, id=user_id)

        if target == request.user:
            return Response(
                {"detail": "You cannot block yourself."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        block, created = UserBlock.objects.get_or_create(
            blocker=request.user,
            blocked=target,
        )

        serializer = UserBlockSerializer(
            block,
            context={"request": request},
        )

        return Response(
            serializer.data,
            status=(
                status.HTTP_201_CREATED
                if created
                else status.HTTP_200_OK
            ),
        )

    def delete(self, request, user_id):
        deleted, _ = UserBlock.objects.filter(
            blocker=request.user,
            blocked_id=user_id,
        ).delete()

        if not deleted:
            return Response(
                {"detail": "User is not blocked."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(status=status.HTTP_204_NO_CONTENT)