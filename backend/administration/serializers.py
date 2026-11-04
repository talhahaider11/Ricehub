from moderation.serializers import (
    AdminAccountReportReviewSerializer,
    AdminAccountReportSerializer,
    AdminContentReportSerializer,
    AdminUserDetailSerializer,
    AdminUserSerializer,
    ContentReportReviewSerializer,
    SuspendUserSerializer,
)

AdminReportSerializer = AdminContentReportSerializer
ReportSerializer = AdminContentReportSerializer

__all__ = [
    "AdminAccountReportReviewSerializer",
    "AdminAccountReportSerializer",
    "AdminContentReportSerializer",
    "AdminReportSerializer",
    "AdminUserDetailSerializer",
    "AdminUserSerializer",
    "ContentReportReviewSerializer",
    "ReportSerializer",
    "SuspendUserSerializer",
]
