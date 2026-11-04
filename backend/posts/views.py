from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Case, Count, IntegerField, Prefetch, Value, When
from django.utils import timezone

from rest_framework import generics
from rest_framework.permissions import BasePermission, SAFE_METHODS
from rest_framework.exceptions import PermissionDenied, ValidationError
from config.permissions import IsActiveAndNotSuspended as IsAuthenticated
from config.pagination import StandardPagination
from config.throttling import PostCreateRateThrottle
from users.privacy import can_view_post, filter_visible_posts
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

    def get_throttles(self):
        throttles = super().get_throttles()
        if self.request.method == "POST":
            return [PostCreateRateThrottle(), *throttles]
        return throttles

    def get_queryset(self):

        user = self.request.user

        author_id = self.request.query_params.get("author")
        if author_id:
            try:
                author_id = int(author_id)
            except ValueError as exc:
                raise ValidationError({"author": "Enter a valid user ID."}) from exc
            if author_id == user.pk:
                queryset = Post.objects.filter(author_id=user.pk)
            else:
                queryset = filter_visible_posts(user).filter(author_id=author_id)
        else:
            queryset = filter_visible_posts(user).exclude(
                author_id=user.pk,
                visibility=Post.Visibility.PRIVATE,
            )

        queryset = (
            queryset
            .select_related("author")
            .prefetch_related(
                Prefetch(
                    "reactions",
                    queryset=Reaction.objects.filter(user=user),
                    to_attr="current_user_reactions",
                ),
                "media_assets",
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
            .annotate(
                boost_priority=Case(
                    When(boosted_until__gt=timezone.now(), then=Value(1)),
                    default=Value(0),
                    output_field=IntegerField(),
                )
            )
        )
        if self.request.query_params.get("sort") == "popular":
            return queryset.order_by(
                "-boost_priority",
                "-reactions_count",
                "-comments_count",
                "-created_at",
            )
        return queryset.order_by("-boost_priority", "-created_at")

    def perform_create(self, serializer):
        User = get_user_model()
        with transaction.atomic():
            author = User.objects.select_for_update().get(
                pk=self.request.user.pk
            )
            if (
                not author.is_verified
                and max(author.posts_created, author.posts.count()) >= 3
            ):
                raise PermissionDenied(
                    "Unverified accounts can publish up to 3 posts. "
                    "Complete verification to post more."
                )
            serializer.save(author=author)
            author.posts_created = max(
                author.posts_created,
                author.posts.count() - 1,
            ) + 1
            author.save(update_fields=("posts_created",))


class IsPostOwnerOrReadOnly(BasePermission):
    def has_object_permission(self, request, view, obj):
        return request.method in SAFE_METHODS or obj.author_id == request.user.pk


class PostDetailView(
    generics.RetrieveUpdateDestroyAPIView
):

    serializer_class = PostSerializer
    permission_classes = [
        IsAuthenticated,
        IsPostOwnerOrReadOnly,
    ]

    queryset = (
        Post.objects
        .select_related("author")
        .prefetch_related("media_assets")
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

        if not can_view_post(user, post):
            raise PermissionDenied("You do not have permission to view this post.")
        return post

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