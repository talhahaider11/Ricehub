from django.db.models import Count, Prefetch, Q

from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from config.pagination import StandardPagination
from friendships.services import get_friend_ids
from users.privacy import get_blocked_user_ids
from reactions.models import Reaction
from .models import Post
from .serializers import PostSerializer
from rest_framework.generics import ListAPIView
from .models import Hashtag
from .serializers import HashtagSerializer


class PostListCreateView(
    generics.ListCreateAPIView
):

    serializer_class = PostSerializer
    pagination_class = StandardPagination
    permission_classes = [
        IsAuthenticated
    ]

    def get_queryset(self):

        user = self.request.user

        friend_ids = get_friend_ids(
            user
        )

        visibility_filter = (
            Q(
                author=user
            )
            | Q(
                visibility=Post.Visibility.PUBLIC
            )
            | Q(
                visibility=Post.Visibility.FRIENDS,
                author_id__in=friend_ids,
            )
        )

        queryset = (
            Post.objects
            .select_related("author")
            .prefetch_related(
                Prefetch(
                    "reactions",
                    queryset=Reaction.objects.filter(user=user),
                    to_attr="current_user_reactions",
                )
            )
            .annotate(
                comments_count=Count(
                    "comments",
                    distinct=True
                ),
                reactions_count=Count(
                    "reactions",
                    distinct=True
                ),
            )
            .filter(
                visibility_filter
            )
            .exclude(author_id__in=get_blocked_user_ids(user))
        )
        if self.request.query_params.get("sort") == "popular":
            return queryset.order_by(
                "-reactions_count",
                "-comments_count",
                "-created_at",
            )
        return queryset.order_by("-created_at")

    def perform_create(self, serializer):

        serializer.save(
            author=self.request.user
        )


class PostDetailView(
    generics.RetrieveUpdateDestroyAPIView
):

    serializer_class = PostSerializer
    permission_classes = [
        IsAuthenticated
    ]

    queryset = (
        Post.objects
        .select_related("author")
        .annotate(
            comments_count=Count(
                "comments",
                distinct=True
            ),
            reactions_count=Count(
                "reactions",
                distinct=True
            ),
        )
    )

    def get_object(self):

        post = super().get_object()

        user = self.request.user

        if post.author_id in get_blocked_user_ids(user):
            raise PermissionDenied(
                "You do not have permission to view this post."
            )

        if post.author == user:
            return post

        if post.visibility == Post.Visibility.PUBLIC:
            return post

        if post.visibility == Post.Visibility.FRIENDS:

            friend_ids = get_friend_ids(
                user
            )

            if post.author_id in friend_ids:
                return post

        raise PermissionDenied(
            "You do not have permission to view this post."
        )

    def perform_update(self, serializer):

        post = self.get_object()

        if post.author != self.request.user:
            raise PermissionDenied(
                "You can only edit your own posts."
            )

        serializer.save()

    def perform_destroy(self, instance):

        if instance.author != self.request.user:
            raise PermissionDenied(
                "You can only delete your own posts."
            )

        instance.delete()

class HashtagSearchView(ListAPIView):
    serializer_class = HashtagSerializer

    def get_queryset(self):
        query = self.request.query_params.get(
            "q",
            ""
        ).strip()

        if not query:
            return Hashtag.objects.none()

        return Hashtag.objects.filter(
            name__icontains=query
        ).order_by("name")[:20]