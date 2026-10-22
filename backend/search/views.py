from django.db.models import Q

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from users.models import User
from posts.models import Post, Hashtag

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
            })

        users = User.objects.filter(
            Q(username__icontains=query)
            | Q(first_name__icontains=query)
            | Q(last_name__icontains=query)
        ).exclude(
            id=request.user.id
        )[:10]

        posts = Post.objects.filter(
            content__icontains=query
        )[:10]

        hashtags = Hashtag.objects.filter(
            name__icontains=query
        )[:10]

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
        })