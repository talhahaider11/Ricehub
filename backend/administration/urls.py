from django.urls import path

from .views import (
    AdminAccountReportDetailView,
    AdminAccountReportListView,
    AdminCommentDeleteView,
    AdminContentReportDetailView,
    AdminContentReportListView,
    AdminDashboardView,
    AdminPostDeleteView,
    AdminPostListView,
    AdminSuspendUserView,
    AdminUnsuspendUserView,
    AdminUserAnalyticsView,
    AdminUserDetailView,
    AdminUserListView,
)

urlpatterns = [
    path("dashboard/", AdminDashboardView.as_view(), name="dashboard"),
    path("users/", AdminUserListView.as_view(), name="users"),
    path("users/<int:pk>/", AdminUserDetailView.as_view(), name="user-detail"),
    path("users/<int:user_id>/suspend/",AdminSuspendUserView.as_view(),name="user-suspend",),
    path("users/<int:user_id>/unsuspend/",AdminUnsuspendUserView.as_view(),name="user-unsuspend",),
    path("reports/", AdminContentReportListView.as_view(), name="reports"),
    path("reports/<int:pk>/",AdminContentReportDetailView.as_view(),name="report-detail",),
    path("account-reports/",AdminAccountReportListView.as_view(),name="account-reports",),
    path("account-reports/<int:pk>/",AdminAccountReportDetailView.as_view(),name="account-report-detail",),
    path("posts/", AdminPostListView.as_view(), name="posts"),
    path("posts/<int:post_id>/",AdminPostDeleteView.as_view(),name="post-delete"),
    path("comments/<int:comment_id>/",AdminCommentDeleteView.as_view(),name="comment-delete",),
    path("analytics/users/",AdminUserAnalyticsView.as_view(),name="user-analytics",),
]
