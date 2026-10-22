from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Reaction
from .serializers import ReactionSerializer
from django.contrib.auth import get_user_model
from notifications.models import Notification
from notifications.services import create_notification
from posts.models import Post


class PostReactionView(APIView):

    permission_classes = [
        IsAuthenticated
    ]

    def post(self, request, post_id):

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

        post = Post.objects.select_related("author").get(id=post_id)

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

        reactions = (
            Reaction.objects
            .filter(post_id=post_id)
            .select_related("user")
        )

        serializer = ReactionSerializer(
            reactions,
            many=True
        )

        return Response(
            serializer.data
        )