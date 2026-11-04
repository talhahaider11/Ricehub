from rest_framework import status
from config.permissions import IsActiveAndNotSuspended as IsAuthenticated
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Reaction
from .serializers import ReactionSerializer
from notifications.models import Notification
from notifications.services import create_notification
from posts.models import Post
from users.privacy import (
    can_view_post,
    get_blocked_user_ids,
    get_muted_user_ids,
)


class PostReactionView(APIView):

    permission_classes = [
        IsAuthenticated
    ]

    def post(self, request, post_id):
        post = get_object_or_404(
            Post.objects.select_related("author"),
            pk=post_id,
        )
        if not can_view_post(request.user, post):
            raise PermissionDenied("This post is unavailable.")

        reaction_type = request.data.get(
            "reaction_type"
        )

        valid_types = {
            choice[0]
            for choice in Reaction.ReactionType.choices
        }

        if reaction_type not in valid_types:
            return Response(
                {
                    "detail": "Invalid reaction type."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        reaction, created = (
            Reaction.objects.update_or_create(
                user=request.user,
                post_id=post_id,
                defaults={
                    "reaction_type": reaction_type
                },
            )
        )

        if post.author != request.user:
            create_notification(
                recipient=post.author,
                sender=request.user,
                notification_type=Notification.NotificationType.REACTION,
                message=(
                    f"{request.user.username} "
                    f"reacted {reaction_type} "
                    "to your post."
                ),
                post_id=post.id,
            )

        return Response(
            ReactionSerializer(reaction).data,
            status=(
                status.HTTP_201_CREATED
                if created
                else status.HTTP_200_OK
            ),
        )

    def delete(self, request, post_id):
        post = get_object_or_404(
            Post.objects.select_related("author"),
            pk=post_id,
        )
        if not can_view_post(request.user, post):
            raise PermissionDenied("This post is unavailable.")

        deleted, _ = (
            Reaction.objects.filter(
                user=request.user,
                post_id=post_id,
            ).delete()
        )

        if deleted == 0:
            return Response(
                {
                    "detail": "Reaction not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            status=status.HTTP_204_NO_CONTENT
        )


class PostReactionListView(APIView):

    permission_classes = [
        IsAuthenticated
    ]

    def get(self, request, post_id):
        post = get_object_or_404(
            Post.objects.select_related("author"),
            pk=post_id,
        )
        if not can_view_post(request.user, post):
            raise PermissionDenied("This post is unavailable.")

        reactions = (
            Reaction.objects
            .filter(post_id=post_id)
            .exclude(
                user_id__in=(
                    get_blocked_user_ids(request.user)
                    | get_muted_user_ids(request.user)
                )
            )
            .select_related("user")
        )

        serializer = ReactionSerializer(
            reactions,
            many=True
        )

        return Response(
            serializer.data
        )