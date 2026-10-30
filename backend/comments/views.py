from django.db.models import Count
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from .models import Comment
from .serializers import CommentSerializer
from notifications.models import Notification
from notifications.services import create_notification


class CommentListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self):
        post_id = self.kwargs["post_id"]
        return (
            Comment.objects
            .filter(
                post_id=post_id,
                parent__isnull=True,
            )
            .select_related("author")
            .order_by("created_at", "id")
            .annotate(
                replies_count=Count(
                    "replies",
                    distinct=True
                )
            )
        )
    def perform_create(self, serializer):
        serializer.save(
            author=self.request.user,
            post_id=self.kwargs["post_id"],
        )
class ReplyListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self):
        return (
            Comment.objects
            .filter(
                parent_id=self.kwargs["comment_id"]
            )
            .select_related("author")
            .order_by("created_at", "id")
        )
    def perform_create(self, serializer):
        serializer.save(
            author=self.request.user,
            post_id=self.kwargs["post_id"],
            parent_id=self.kwargs["comment_id"],
        )
class CommentDetailView(
    generics.RetrieveUpdateDestroyAPIView
):
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated]

    queryset = Comment.objects.select_related(
        "author"
    )
    def perform_update(self, serializer):
        comment = self.get_object()        
        if comment.post.author != self.request.user:
            create_notification(
                recipient=comment.post.author,
                sender=self.request.user,
                notification_type=(
                    Notification.NotificationType.COMMENT
                ),
                message=(
                    f"{self.request.user.username} "
                    "commented on your post."
                ),
                post_id=comment.post_id,
                comment_id=comment.id,
            )
        serializer.save()
    def perform_destroy(self, instance):
        if instance.author != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied(
                "You can only delete your own comments."
            )
        instance.delete()