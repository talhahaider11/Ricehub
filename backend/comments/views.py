from django.db.models import Count
from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.exceptions import PermissionDenied

from config.permissions import IsActiveAndNotSuspended as IsAuthenticated
from posts.models import Post
from users.privacy import (
    can_view_post,
    get_blocked_user_ids,
    get_muted_user_ids,
)
from .models import Comment
from .serializers import CommentSerializer
from notifications.models import Notification
from notifications.services import create_notification


class CommentListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated]

    def get_visible_post(self):
        post = get_object_or_404(
            Post.objects.select_related("author"),
            pk=self.kwargs["post_id"],
        )
        if not can_view_post(self.request.user, post):
            raise PermissionDenied("This post is unavailable.")
        return post

    def get_queryset(self):
        self.get_visible_post()
        post_id = self.kwargs["post_id"]
        hidden_author_ids = (
            get_blocked_user_ids(self.request.user)
            | get_muted_user_ids(self.request.user)
        )
        return (
            Comment.objects
            .filter(
                post_id=post_id,
                parent__isnull=True,
            )
            .exclude(author_id__in=hidden_author_ids)
            .select_related("author")
            .order_by("created_at", "id")
            .annotate(
                replies_count=Count(
                    "replies",
                    distinct=True,
                )
            )
        )

    def perform_create(self, serializer):
        post = self.get_visible_post()
        serializer.save(
            author=self.request.user,
            post=post,
        )


class ReplyListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated]

    def get_parent_comment(self):
        hidden_author_ids = (
            get_blocked_user_ids(self.request.user)
            | get_muted_user_ids(self.request.user)
        )
        comment = get_object_or_404(
            Comment.objects.select_related("post__author"),
            pk=self.kwargs["comment_id"],
            post_id=self.kwargs["post_id"],
        )
        if comment.author_id in hidden_author_ids:
            raise PermissionDenied("This comment is unavailable.")
        if not can_view_post(self.request.user, comment.post):
            raise PermissionDenied("This post is unavailable.")
        return comment

    def get_queryset(self):
        self.get_parent_comment()
        hidden_author_ids = (
            get_blocked_user_ids(self.request.user)
            | get_muted_user_ids(self.request.user)
        )
        return (
            Comment.objects
            .filter(
                parent_id=self.kwargs["comment_id"],
                post_id=self.kwargs["post_id"],
            )
            .exclude(author_id__in=hidden_author_ids)
            .select_related("author")
            .order_by("created_at", "id")
        )

    def perform_create(self, serializer):
        parent = self.get_parent_comment()
        serializer.save(
            author=self.request.user,
            post=parent.post,
            parent=parent,
        )


class CommentDetailView(
    generics.RetrieveUpdateDestroyAPIView
):
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated]

    queryset = Comment.objects.select_related(
        "author",
        "post__author",
    )

    def get_queryset(self):
        hidden_author_ids = (
            get_blocked_user_ids(self.request.user)
            | get_muted_user_ids(self.request.user)
        )
        return super().get_queryset().exclude(
            author_id__in=hidden_author_ids
        )

    def get_object(self):
        comment = super().get_object()
        if not can_view_post(self.request.user, comment.post):
            raise PermissionDenied("This post is unavailable.")
        return comment

    def perform_update(self, serializer):
        comment = self.get_object()
        if comment.author_id != self.request.user.pk:
            raise PermissionDenied("You can only edit your own comments.")
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
            raise PermissionDenied(
                "You can only delete your own comments."
            )
        instance.delete()