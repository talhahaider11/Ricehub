from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from config.throttling import AdminThrottleMixin
from messaging.models import Message
from moderation.models import ContentReport
from moderation.views import (
    AdminAccountReportDetailView,
    AdminAccountReportListView,
    AdminCommentDeleteView,
    AdminContentReportDetailView,
    AdminContentReportListView,
    AdminPostDeleteView,
    AdminPostListView,
    AdminSuspendUserView,
    AdminUnsuspendUserView,
    AdminUserAnalyticsView,
    AdminUserDetailView,
    AdminUserListView,
)
from comments.models import Comment
from posts.models import Post
from users.models import AccountReport

from .permissions import IsAdminUser

User = get_user_model()


class AdminDashboardView(AdminThrottleMixin, APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        today = timezone.localdate()
        return Response(
            {
                "users": {
                    "total": User.objects.count(),
                    "active": User.objects.filter(is_active=True).count(),
                    "new_today": User.objects.filter(
                        date_joined__date=today,
                    ).count(),
                },
                "content": {
                    "posts": Post.objects.count(),
                    "comments": Comment.objects.count(),
                },
                "messages": {
                    "total": Message.objects.count(),
                },
                "reports": {
                    "pending": (
                        ContentReport.objects.filter(
                            status=ContentReport.Status.OPEN,
                        ).count()
                        + AccountReport.objects.filter(
                            status=AccountReport.Status.OPEN,
                        ).count()
                    ),
                },
            }
        )


__all__ = [
    "AdminAccountReportDetailView",
    "AdminAccountReportListView",
    "AdminCommentDeleteView",
    "AdminContentReportDetailView",
    "AdminContentReportListView",
    "AdminDashboardView",
    "AdminPostDeleteView",
    "AdminPostListView",
    "AdminSuspendUserView",
    "AdminUnsuspendUserView",
    "AdminUserAnalyticsView",
    "AdminUserDetailView",
    "AdminUserListView",
]
