from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from config.permissions import (
    IsActiveAdminUser as IsAdminUser,
    IsActiveAndNotSuspended as IsAuthenticated,
)
from config.throttling import (
    AdminThrottleMixin,
    ModerationThrottleMixin,
    ReportRateThrottle,
)
from comments.models import Comment
from friendships.models import FriendRequest
from posts.models import Post
from posts.serializers import PostSerializer
from users.models import AccountReport, BlockedUser
from users.serializers import BlockedUserSerializer

from .models import AdminActionLog, ContentReport
from .serializers import (
    AdminAccountReportReviewSerializer,
    AdminAccountReportSerializer,
    AdminContentReportSerializer,
    AdminUserDetailSerializer,
    AdminUserSerializer,
    ContentReportCreateSerializer,
    ContentReportReviewSerializer,
    SuspendUserSerializer,
)

User = get_user_model()


class BlockUserView(ModerationThrottleMixin, APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id):
        target = get_object_or_404(User, pk=user_id)
        if target.pk == request.user.pk:
            raise ValidationError({"user_id": "You cannot block yourself."})

        block, created = BlockedUser.objects.get_or_create(
            blocker=request.user,
            blocked=target,
        )
        return Response(
            BlockedUserSerializer(block).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request, user_id):
        deleted, _ = BlockedUser.objects.filter(
            blocker=request.user,
            blocked_id=user_id,
        ).delete()
        if not deleted:
            return Response(
                {"detail": "Blocked user not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class BlockedUsersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        blocks = BlockedUser.objects.filter(
            blocker=request.user,
        ).select_related("blocked")
        return Response(BlockedUserSerializer(blocks, many=True).data)


class ContentReportCreateView(ModerationThrottleMixin, generics.CreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ContentReportCreateSerializer
    throttle_classes = [ReportRateThrottle]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = serializer.save()
        return Response(
            {
                "detail": "Thanks. Your report was submitted for review.",
                "report": AdminContentReportSerializer(report).data,
            },
            status=status.HTTP_201_CREATED,
        )


class AdminContentReportListView(AdminThrottleMixin, generics.ListAPIView):
    permission_classes = [IsAdminUser]
    serializer_class = AdminContentReportSerializer

    def get_queryset(self):
        queryset = ContentReport.objects.select_related(
            "reporter",
            "target_author",
            "reviewed_by",
        )
        report_status = self.request.query_params.get("status", "open")
        valid_statuses = {choice[0] for choice in ContentReport.Status.choices}
        if report_status not in valid_statuses:
            raise ValidationError(
                {"status": f"Choose one of: {', '.join(sorted(valid_statuses))}."}
            )
        return queryset.filter(status=report_status)


class AdminContentReportDetailView(
    AdminThrottleMixin,
    ModerationThrottleMixin,
    generics.GenericAPIView,
):
    permission_classes = [IsAdminUser]
    serializer_class = ContentReportReviewSerializer
    queryset = ContentReport.objects.select_related("reporter", "target_author")

    @transaction.atomic
    def patch(self, request, pk):
        report = self.get_object()
        serializer = self.get_serializer(report, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        report = serializer.save(
            reviewed_by=request.user,
            reviewed_at=timezone.now(),
        )
        AdminActionLog.objects.create(
            actor=request.user,
            action=f"{report.status}_content_report",
            target_type="content_report",
            target_id=report.pk,
            reason=report.resolution_note,
        )
        return Response(AdminContentReportSerializer(report).data)

    def get(self, request, pk):
        return Response(AdminContentReportSerializer(self.get_object()).data)


class AdminAccountReportListView(AdminThrottleMixin, generics.ListAPIView):
    permission_classes = [IsAdminUser]
    serializer_class = AdminAccountReportSerializer

    def get_queryset(self):
        report_status = self.request.query_params.get("status", "open")
        valid_statuses = {choice[0] for choice in AccountReport.Status.choices}
        if report_status not in valid_statuses:
            raise ValidationError(
                {"status": f"Choose one of: {', '.join(sorted(valid_statuses))}."}
            )
        return AccountReport.objects.select_related(
            "reporter",
            "reported_user",
            "reviewed_by",
        ).filter(status=report_status).order_by("-created_at")


class AdminAccountReportDetailView(
    AdminThrottleMixin,
    ModerationThrottleMixin,
    generics.GenericAPIView,
):
    permission_classes = [IsAdminUser]
    serializer_class = AdminAccountReportReviewSerializer
    queryset = AccountReport.objects.select_related("reporter", "reported_user")

    def get(self, request, pk):
        return Response(AdminAccountReportSerializer(self.get_object()).data)

    @transaction.atomic
    def patch(self, request, pk):
        report = self.get_object()
        serializer = self.get_serializer(report, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        update_fields = {
            "status": serializer.validated_data.get("status", report.status),
            "moderator_notes": serializer.validated_data.get(
                "moderator_notes",
                report.moderator_notes,
            ),
            "reviewed_by": request.user,
            "reviewed_at": timezone.now(),
        }
        for field, value in update_fields.items():
            setattr(report, field, value)
        report.save(update_fields=list(update_fields))
        AdminActionLog.objects.create(
            actor=request.user,
            action=f"{report.status}_account_report",
            target_type="account_report",
            target_id=report.pk,
            reason=report.moderator_notes,
        )
        return Response(AdminAccountReportSerializer(report).data)


class AdminOverviewView(AdminThrottleMixin, APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        today = timezone.localdate()
        return Response(
            {
                "users": User.objects.count(),
                "users_today": User.objects.filter(created_at__date=today).count(),
                "posts": Post.objects.count(),
                "comments": Comment.objects.count(),
                "open_content_reports": ContentReport.objects.filter(
                    status=ContentReport.Status.OPEN,
                ).count(),
                "open_account_reports": AccountReport.objects.filter(
                    status=AccountReport.Status.OPEN,
                ).count(),
            }
        )


class AdminUserListView(AdminThrottleMixin, generics.ListAPIView):
    permission_classes = [IsAdminUser]
    serializer_class = AdminUserSerializer

    def get_queryset(self):
        queryset = User.objects.all().order_by("-created_at")
        query = self.request.query_params.get("q", "").strip()
        if query:
            queryset = queryset.filter(
                Q(username__icontains=query)
                | Q(email__icontains=query)
                | Q(first_name__icontains=query)
                | Q(last_name__icontains=query)
            )
        account_status = self.request.query_params.get("status", "all")
        if account_status == "active":
            queryset = queryset.filter(is_active=True, is_suspended=False)
        elif account_status == "suspended":
            queryset = queryset.filter(is_suspended=True)
        elif account_status == "inactive":
            queryset = queryset.filter(is_active=False, is_suspended=False)
        elif account_status != "all":
            raise ValidationError(
                {"status": "Choose active, suspended, inactive, or all."}
            )
        for parameter, field in (
            ("staff", "is_staff"),
            ("suspended", "is_suspended"),
        ):
            value = self.request.query_params.get(parameter)
            if value is not None:
                normalized = value.lower()
                if normalized not in {"true", "false"}:
                    raise ValidationError(
                        {parameter: "Choose true or false."}
                    )
                queryset = queryset.filter(**{field: normalized == "true"})
        return queryset


class AdminUserDetailView(
    AdminThrottleMixin,
    ModerationThrottleMixin,
    generics.RetrieveDestroyAPIView,
):
    permission_classes = [IsAdminUser]
    serializer_class = AdminUserDetailSerializer

    def get_queryset(self):
        return User.objects.annotate(
            post_count=Count("posts", distinct=True),
            accepted_sent_friend_count=Count(
                "sent_friend_requests",
                filter=Q(
                    sent_friend_requests__status=FriendRequest.Status.ACCEPTED,
                ),
                distinct=True,
            ),
            accepted_received_friend_count=Count(
                "received_friend_requests",
                filter=Q(
                    received_friend_requests__status=FriendRequest.Status.ACCEPTED,
                ),
                distinct=True,
            ),
        )

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user.pk == request.user.pk:
            raise ValidationError({"user_id": "You cannot delete yourself."})
        if user.is_superuser:
            raise ValidationError(
                {"user_id": "A superuser cannot be deleted here."}
            )

        AdminActionLog.objects.create(
            actor=request.user,
            action="delete_user",
            target_type="user",
            target_id=user.pk,
            reason=str(request.data.get("reason", "")).strip()[:2000],
            metadata={"username": user.username},
        )
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminSuspendUserView(AdminThrottleMixin, ModerationThrottleMixin, APIView):
    permission_classes = [IsAdminUser]

    @transaction.atomic
    def post(self, request, user_id):
        user = get_object_or_404(User, pk=user_id)
        if user.pk == request.user.pk:
            raise ValidationError({"user_id": "You cannot suspend yourself."})
        if user.is_superuser:
            raise ValidationError({"user_id": "A superuser cannot be suspended."})

        serializer = SuspendUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data["reason"]
        if user.is_suspended:
            return Response(AdminUserSerializer(user).data)

        user.suspension_was_active = user.is_active
        user.is_active = False
        user.is_suspended = True
        user.suspended_until = None
        user.suspension_reason = reason
        user.suspended_at = timezone.now()
        user.suspended_by = request.user
        user.save(
            update_fields=[
                "is_active",
                "is_suspended",
                "suspended_until",
                "suspension_reason",
                "suspended_at",
                "suspended_by",
                "suspension_was_active",
            ]
        )
        _blacklist_user_refresh_tokens(user)
        AdminActionLog.objects.create(
            actor=request.user,
            action="suspend_user",
            target_type="user",
            target_id=user.pk,
            reason=reason,
        )
        return Response(AdminUserSerializer(user).data)


class AdminUnsuspendUserView(AdminThrottleMixin, ModerationThrottleMixin, APIView):
    permission_classes = [IsAdminUser]

    @transaction.atomic
    def post(self, request, user_id):
        user = get_object_or_404(User, pk=user_id)
        if not user.is_suspended:
            return Response(AdminUserSerializer(user).data)

        user.is_active = bool(user.suspension_was_active)
        user.is_suspended = False
        user.suspended_until = None
        user.suspension_reason = ""
        user.suspended_at = None
        user.suspended_by = None
        user.suspension_was_active = None
        user.save(
            update_fields=[
                "is_active",
                "is_suspended",
                "suspended_until",
                "suspension_reason",
                "suspended_at",
                "suspended_by",
                "suspension_was_active",
            ]
        )
        AdminActionLog.objects.create(
            actor=request.user,
            action="unsuspend_user",
            target_type="user",
            target_id=user.pk,
        )
        return Response(AdminUserSerializer(user).data)


class AdminPostListView(AdminThrottleMixin, generics.ListAPIView):
    permission_classes = [IsAdminUser]
    serializer_class = PostSerializer

    def get_queryset(self):
        queryset = Post.objects.select_related("author").prefetch_related(
            "hashtags",
            "media_assets",
        )
        query = self.request.query_params.get("q", "").strip()
        if query:
            queryset = queryset.filter(
                Q(content__icontains=query)
                | Q(author__username__icontains=query)
            )
        return queryset.order_by("-created_at")


class AdminPostDeleteView(AdminThrottleMixin, ModerationThrottleMixin, APIView):
    permission_classes = [IsAdminUser]

    @transaction.atomic
    def delete(self, request, post_id):
        post = get_object_or_404(Post, pk=post_id)
        reason = str(request.data.get("reason", "")).strip()[:2000]
        AdminActionLog.objects.create(
            actor=request.user,
            action="delete_post",
            target_type="post",
            target_id=post.pk,
            reason=reason,
            metadata={"author_id": post.author_id, "content": post.content[:500]},
        )
        post.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminCommentDeleteView(AdminThrottleMixin, ModerationThrottleMixin, APIView):
    permission_classes = [IsAdminUser]

    @transaction.atomic
    def delete(self, request, comment_id):
        comment = get_object_or_404(Comment, pk=comment_id)
        reason = str(request.data.get("reason", "")).strip()[:2000]
        AdminActionLog.objects.create(
            actor=request.user,
            action="delete_comment",
            target_type="comment",
            target_id=comment.pk,
            reason=reason,
            metadata={
                "author_id": comment.author_id,
                "post_id": comment.post_id,
                "content": comment.content[:500],
            },
        )
        comment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminUserAnalyticsView(AdminThrottleMixin, APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        try:
            days = int(request.query_params.get("days", "30"))
        except ValueError as error:
            raise ValidationError({"days": "Enter a whole number."}) from error
        if days < 1 or days > 365:
            raise ValidationError({"days": "Choose a value from 1 to 365."})

        start_date = timezone.localdate() - timedelta(days=days - 1)
        growth = (
            User.objects.filter(created_at__date__gte=start_date)
            .annotate(date=TruncDate("created_at"))
            .values("date")
            .annotate(count=Count("id"))
            .order_by("date")
        )
        return Response(
            {
                "days": days,
                "total_users": User.objects.count(),
                "active_users": User.objects.filter(is_active=True).count(),
                "suspended_users": User.objects.filter(is_suspended=True).count(),
                "daily_signups": list(growth),
            }
        )


def _blacklist_user_refresh_tokens(user):
    from rest_framework_simplejwt.token_blacklist.models import (
        BlacklistedToken,
        OutstandingToken,
    )

    for token in OutstandingToken.objects.filter(user=user).iterator():
        BlacklistedToken.objects.get_or_create(token=token)
