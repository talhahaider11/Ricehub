from datetime import timedelta

from django.db.models import Count, Prefetch, Q
from django.utils import timezone

from config.permissions import IsActiveAndNotSuspended as IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.generics import GenericAPIView

from config.pagination import StandardPagination
from users.privacy import get_blocked_user_ids, get_muted_user_ids
from posts.models import Hashtag
from posts.serializers import PostSerializer
from reactions.models import Reaction
from community.models import Community
from community.serializers import CommunitySerializer

from .services import (
    get_user_suggestions,
    search_posts,
    search_users,
    visible_posts_for,
)
from .serializers import (
    SearchUserSerializer,
    SearchPostSerializer,
    SearchHashtagSerializer,
)


class GlobalSearchView(APIView):
    permission_classes = [
        IsAuthenticated
    ]

    def get(self, request):
        query = request.query_params.get(
            "q",
            ""
        ).strip()

        if not query:
            return Response({
                "users": [],
                "posts": [],
                "hashtags": [],
                "groups": [],
            })

        query = query.lstrip("#").strip()
        if not query:
            return Response({
                "users": [],
                "posts": [],
                "hashtags": [],
                "groups": [],
            })
        excluded_user_ids = (
            get_blocked_user_ids(request.user)
            | get_muted_user_ids(request.user)
        )
        users = search_users(request.user, query)[:10]
        posts = search_posts(request.user, query).prefetch_related(
            "media_assets"
        )[:10]
        visible_posts = visible_posts_for(request.user)
        hashtags = (
            Hashtag.objects.filter(
                name__icontains=query,
                posts__in=visible_posts,
            )
            .annotate(
                post_count=Count(
                    "posts",
                    filter=Q(posts__in=visible_posts),
                    distinct=True,
                )
            )
            .distinct()[:10]
        )

        groups = Community.objects.filter(
            Q(name__icontains=query) | Q(description__icontains=query)
        ).filter(
            Q(visibility=Community.Visibility.PUBLIC)
            | Q(memberships__user=request.user)
        ).exclude(
            owner_id__in=excluded_user_ids,
        ).filter(
            owner__is_active=True,
            owner__is_suspended=False,
        ).distinct().annotate(
            member_count=Count("memberships", distinct=True),
        ).prefetch_related("memberships__user")[:10]

        return Response({
            "users": SearchUserSerializer(
                users,
                many=True
            ).data,

            "posts": SearchPostSerializer(
                posts,
                many=True,
                context={"request": request},
            ).data,

            "hashtags": SearchHashtagSerializer(
                hashtags,
                many=True
            ).data,
            "groups": CommunitySerializer(
                groups,
                many=True,
                context={"request": request},
            ).data,
        })


def posts_for_serialization(queryset, user):
    return queryset.select_related("author").prefetch_related(
        Prefetch(
            "reactions",
            queryset=Reaction.objects.filter(user=user),
            to_attr="current_user_reactions",
        ),
        "hashtags",
        "media_assets",
    ).annotate(
        comments_count=Count("comments", distinct=True),
        reactions_count=Count("reactions", distinct=True),
    )


class PostSearchView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination
    serializer_class = PostSerializer

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if len(query.lstrip("#").strip()) < 2:
            return Response({
                "count": 0,
                "next": None,
                "previous": None,
                "results": [],
                "message": "Enter at least 2 characters.",
            })

        posts = posts_for_serialization(
            search_posts(request.user, query),
            request.user,
        )
        page = self.paginate_queryset(posts)
        serializer = self.get_serializer(
            page,
            many=True,
            context={"request": request},
        )
        return self.get_paginated_response(serializer.data)


class UserSuggestionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        users = get_user_suggestions(request.user)
        return Response({
            "results": SearchUserSerializer(
                users,
                many=True,
                context={"request": request},
            ).data,
        })


class TrendingHashtagsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        since = timezone.now() - timedelta(hours=24)
        visible_posts = visible_posts_for(request.user).filter(
            created_at__gte=since,
        )
        hashtags = (
            Hashtag.objects.filter(posts__in=visible_posts)
            .annotate(
                post_count=Count(
                    "posts",
                    filter=Q(posts__in=visible_posts),
                    distinct=True,
                )
            )
            .order_by("-post_count", "name")[:20]
        )
        return Response({
            "results": SearchHashtagSerializer(
                hashtags,
                many=True,
            ).data,
        })


class HashtagDetailView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination
    serializer_class = PostSerializer

    def get(self, request, tag):
        tag = tag.strip().lstrip("#").lower()
        posts = visible_posts_for(request.user).filter(
            hashtags__name__iexact=tag,
        ).order_by("-created_at").distinct()
        posts = posts_for_serialization(posts, request.user)
        page = self.paginate_queryset(posts)
        serializer = self.get_serializer(
            page,
            many=True,
            context={"request": request},
        )
        paginated = self.get_paginated_response(serializer.data).data
        return Response({
            "hashtag": tag,
            "posts": paginated["results"],
            "count": paginated["count"],
            "next": paginated["next"],
            "previous": paginated["previous"],
        })


class ExploreView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination
    serializer_class = PostSerializer

    def get(self, request):
        visible_posts = visible_posts_for(request.user)
        posts = posts_for_serialization(
            visible_posts.order_by("-created_at").distinct(),
            request.user,
        )
        page = self.paginate_queryset(posts)
        serialized_posts = self.get_serializer(
            page,
            many=True,
            context={"request": request},
        ).data
        paginated = self.get_paginated_response(serialized_posts).data
        trending_posts = visible_posts.filter(
            created_at__gte=timezone.now() - timedelta(hours=24),
        )
        hashtags = (
            Hashtag.objects.filter(posts__in=trending_posts)
            .annotate(
                post_count=Count(
                    "posts",
                    filter=Q(posts__in=trending_posts),
                    distinct=True,
                )
            )
            .order_by("-post_count", "name")[:10]
        )
        suggestions = get_user_suggestions(request.user, limit=10)

        return Response({
            "posts": paginated["results"],
            "pagination": {
                "count": paginated["count"],
                "next": paginated["next"],
                "previous": paginated["previous"],
            },
            "hashtags": SearchHashtagSerializer(
                hashtags,
                many=True,
            ).data,
            "suggested_users": SearchUserSerializer(
                suggestions,
                many=True,
                context={"request": request},
            ).data,
        })