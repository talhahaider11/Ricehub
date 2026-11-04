from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core import signing
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import BasePagination
from rest_framework.pagination import PageNumberPagination
from config.permissions import IsActiveAndNotSuspended as IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.utils.urls import replace_query_param

from .constants import FEED_PAGE_SIZE, FOR_YOU_CANDIDATE_LIMIT
from .models import FeedInteraction
from .serializers import FeedPostSerializer
from .services import get_eligible_posts, get_ranked_feed

User = get_user_model()


class RankedFeedCursorPagination(BasePagination):
    page_size = FEED_PAGE_SIZE
    max_page_size = 50
    cursor_query_param = "cursor"
    cursor_salt = "feed.for-you.cursor"
    cursor_max_age = 60 * 60

    def paginate_queryset(self, queryset, request, view=None):
        requested_page_size = request.query_params.get("page_size")
        if requested_page_size is not None:
            try:
                requested_page_size = int(requested_page_size)
            except ValueError as error:
                raise ValidationError(
                    {"page_size": "Enter a whole number."}
                ) from error
            if not 1 <= requested_page_size <= self.max_page_size:
                raise ValidationError(
                    {"page_size": f"Choose a value from 1 to {self.max_page_size}."}
                )
            self.page_size = requested_page_size

        cursor = request.query_params.get(self.cursor_query_param)
        offset = 0
        if cursor:
            try:
                payload = signing.loads(
                    cursor,
                    salt=self.cursor_salt,
                    max_age=self.cursor_max_age,
                )
                offset = payload["offset"]
                cursor_page_size = payload["page_size"]
            except (signing.BadSignature, KeyError, TypeError) as error:
                raise ValidationError(
                    {"cursor": "Invalid or expired feed cursor."}
                ) from error
            if (
                not isinstance(offset, int)
                or isinstance(offset, bool)
                or offset < 0
                or not isinstance(cursor_page_size, int)
                or isinstance(cursor_page_size, bool)
                or not 1 <= cursor_page_size <= self.max_page_size
            ):
                raise ValidationError(
                    {"cursor": "Invalid or expired feed cursor."}
                )
            if requested_page_size is not None and requested_page_size != cursor_page_size:
                raise ValidationError(
                    {"page_size": "Page size cannot change while following a feed cursor."}
                )
            self.page_size = cursor_page_size

        self.request = request
        self.offset = offset
        self.count = len(queryset)
        self.page = list(queryset[offset:offset + self.page_size])
        return self.page

    def _cursor_url(self, offset):
        cursor = signing.dumps(
            {"offset": offset, "page_size": self.page_size},
            salt=self.cursor_salt,
        )
        return replace_query_param(
            self.request.build_absolute_uri(),
            self.cursor_query_param,
            cursor,
        )

    def get_paginated_response(self, data):
        next_offset = self.offset + len(self.page)
        previous_offset = max(self.offset - self.page_size, 0)
        return Response({
            "count": self.count,
            "next": (
                self._cursor_url(next_offset)
                if next_offset < self.count and self.page
                else None
            ),
            "previous": (
                self._cursor_url(previous_offset)
                if self.offset > 0
                else None
            ),
            "results": data,
        })


class FeedPagination(PageNumberPagination):
    page_size = FEED_PAGE_SIZE
    page_size_query_param = "page_size"
    max_page_size = 50


class FeedView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ranked_posts = get_ranked_feed(request.user)
        if (
            "cursor" not in request.query_params
            and (
                "page" in request.query_params
                or "page_size" in request.query_params
            )
        ):
            paginator = FeedPagination()
        else:
            paginator = RankedFeedCursorPagination()
        page = paginator.paginate_queryset(ranked_posts, request, view=self)
        serializer = FeedPostSerializer(
            page,
            many=True,
            context={"request": request},
        )
        return paginator.get_paginated_response(serializer.data)


class ForYouFeedView(FeedView):
    pagination_class = RankedFeedCursorPagination

    def get(self, request):
        ranked_posts = get_ranked_feed(
            request.user,
            candidate_limit=FOR_YOU_CANDIDATE_LIMIT,
        )
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(ranked_posts, request, view=self)
        serializer = FeedPostSerializer(
            page,
            many=True,
            context={"request": request},
        )
        return paginator.get_paginated_response(serializer.data)


class FeedPostViewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, post_id):
        post = get_object_or_404(
            get_eligible_posts(request.user),
            pk=post_id,
        )
        cutoff = timezone.now() - timedelta(hours=24)
        with transaction.atomic():
            User.objects.select_for_update().get(pk=request.user.pk)
            existing_view = FeedInteraction.objects.filter(
                user=request.user,
                post=post,
                interaction_type=FeedInteraction.InteractionType.VIEW,
                created_at__gte=cutoff,
            ).exists()
            if existing_view:
                return Response(
                    {"success": True, "recorded": False},
                    status=status.HTTP_200_OK,
                )
            FeedInteraction.objects.create(
                user=request.user,
                post=post,
                interaction_type=FeedInteraction.InteractionType.VIEW,
            )
        return Response(
            {"success": True, "recorded": True},
            status=status.HTTP_201_CREATED,
        )
