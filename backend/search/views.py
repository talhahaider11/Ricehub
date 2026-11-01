from django.db.models import Count, Q

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from users.models import User
from users.privacy import get_blocked_user_ids, get_muted_user_ids
from friendships.services import get_friend_ids
from posts.models import Post, Hashtag
from community.models import Community
from community.serializers import CommunitySerializer

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

        excluded_user_ids = get_blocked_user_ids(request.user) | get_muted_user_ids(request.user)
        users = User.objects.filter(
            Q(username__icontains=query)
            | Q(first_name__icontains=query)
            | Q(last_name__icontains=query)
        ).exclude(
            id=request.user.id
        ).exclude(id__in=excluded_user_ids)[:10]

        posts = Post.objects.filter(
            Q(content__icontains=query)
            & (
                Q(author=request.user)
                | Q(visibility=Post.Visibility.PUBLIC)
                | Q(
                    visibility=Post.Visibility.FRIENDS,
                    author_id__in=get_friend_ids(request.user),
                )
            )
        ).exclude(author_id__in=excluded_user_ids).select_related("author")[:10]

        hashtags = Hashtag.objects.filter(
            name__icontains=query
        )[:10]

        groups = Community.objects.filter(
            Q(name__icontains=query) | Q(description__icontains=query)
        ).filter(
            Q(visibility=Community.Visibility.PUBLIC)
            | Q(memberships__user=request.user)
        ).exclude(
            owner_id__in=excluded_user_ids,
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
                many=True
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