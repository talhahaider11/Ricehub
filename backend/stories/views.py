from django.db import transaction
from django.db.models import Count, Exists, OuterRef, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from config.permissions import IsActiveAndNotSuspended
from rest_framework.response import Response
from rest_framework.views import APIView

from friendships.services import get_friend_ids
from users.models import ProfileVisibility
from users.privacy import get_blocked_user_ids, get_muted_user_ids

from .models import Story, StoryView
from .permissions import can_view_story
from .serializers import StorySerializer
from .services import mark_story_viewed

ACTIVE_STORY_LIMIT = 100


class StoryListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsActiveAndNotSuspended]
    serializer_class = StorySerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        friend_ids = set(get_friend_ids(user))
        author_id = self.request.query_params.get("author")
        visible_stories = (
            Q(author_id=user.pk)
            | Q(
                visibility=Story.Visibility.PUBLIC,
                author__profile_visibility=ProfileVisibility.PUBLIC,
                author__is_active=True,
                author__is_suspended=False,
            )
            | Q(
                visibility=Story.Visibility.PUBLIC,
                author__profile_visibility__in=[
                    ProfileVisibility.FRIENDS,
                    ProfileVisibility.PRIVATE,
                ],
                author_id__in=friend_ids,
            )
            | Q(
                visibility=Story.Visibility.FRIENDS,
                author_id__in=friend_ids,
            )
        )
        queryset = (
            Story.objects.active()
            .filter(visible_stories)
            .exclude(
                author_id__in=(
                    get_blocked_user_ids(user) | get_muted_user_ids(user)
                )
            )
            .filter(
                author__is_active=True,
                author__is_suspended=False,
            )
            .select_related("author", "media_asset")
            .annotate(
                seen_by_user=Exists(
                    StoryView.objects.filter(
                        story_id=OuterRef("pk"),
                        viewer=user,
                    )
                ),
                view_count=Count("views", distinct=True),
            )
            .order_by("seen_by_user", "created_at", "pk")
        )
        if author_id is not None:
            try:
                author_id = int(author_id)
            except ValueError as error:
                raise ValidationError(
                    {"author": "Must be a valid user ID."}
                ) from error
            queryset = queryset.filter(author_id=author_id)
        return queryset

    def create(self, request, *args, **kwargs):
        with transaction.atomic():
            type(request.user).objects.select_for_update().only("pk").get(
                pk=request.user.pk,
            )
            active_story_count = Story.objects.active().filter(
                author=request.user,
            ).count()
            if active_story_count >= ACTIVE_STORY_LIMIT:
                return Response(
                    {"detail": "You can have up to 100 active stories."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return super().create(request, *args, **kwargs)


class StoryDetailView(APIView):
    permission_classes = [IsActiveAndNotSuspended]

    def get(self, request, story_id):
        story = get_object_or_404(
            Story.objects.active().select_related("author", "media_asset"),
            pk=story_id,
        )
        if not can_view_story(request.user, story):
            raise PermissionDenied("You cannot view this story.")
        story.seen_by_user = StoryView.objects.filter(
            story=story,
            viewer=request.user,
        ).exists()
        story.view_count = story.views.count()
        return Response(
            StorySerializer(story, context={"request": request}).data
        )

    def delete(self, request, story_id):
        story = get_object_or_404(
            Story.all_objects,
            pk=story_id,
            author=request.user,
        )
        story.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MarkStoryViewedView(APIView):
    permission_classes = [IsActiveAndNotSuspended]

    def post(self, request, story_id):
        story = get_object_or_404(
            Story.objects.active().select_related("author", "media_asset"),
            pk=story_id,
        )
        if not can_view_story(request.user, story):
            raise PermissionDenied("You cannot view this story.")
        if story.author_id == request.user.pk:
            return Response(
                {"detail": "You cannot count your own story as a view."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        mark_story_viewed(request.user, story)
        return Response({"message": "Story marked as viewed."})


class StoryViewerListView(APIView):
    permission_classes = [IsActiveAndNotSuspended]

    def get(self, request, story_id):
        story = get_object_or_404(
            Story.objects.active(),
            pk=story_id,
            author=request.user,
        )
        blocked_ids = get_blocked_user_ids(request.user)
        views = (
            StoryView.objects
            .filter(story=story)
            .exclude(viewer_id__in=blocked_ids)
            .filter(viewer__is_active=True, viewer__is_suspended=False)
            .select_related("viewer")
            .order_by("-viewed_at")
        )
        results = []
        for view in views:
            viewer = view.viewer
            avatar = viewer.profile_picture.url if viewer.profile_picture else None
            if avatar and request:
                avatar = request.build_absolute_uri(avatar)
            results.append(
                {
                    "id": viewer.pk,
                    "username": viewer.username,
                    "first_name": viewer.first_name,
                    "last_name": viewer.last_name,
                    "avatar": avatar,
                    "viewed_at": view.viewed_at,
                }
            )
        return Response({"results": results})
