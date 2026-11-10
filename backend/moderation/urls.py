from django.urls import path

from .views import (
    AdminContentReportDetailView,
    AdminContentReportListView,
    AdminAccountReportDetailView,
    AdminAccountReportListView,
    AdminCommentDeleteView,
    AdminOverviewView,
    AdminPostDeleteView,
    AdminPostListView,
    AdminSuspendUserView,
    AdminUnsuspendUserView,
    AdminUserAnalyticsView,
    AdminUserDetailView,
    AdminUserListView,
    BlockedUsersView,
    BlockUserView,
    ContentReportCreateView,
)

urlpatterns = [
    path("users/<int:user_id>/block/", BlockUserView.as_view(), name="block-user"),
    path("blocks/", BlockedUsersView.as_view(), name="blocked-users"),
    path("content-reports/",ContentReportCreateView.as_view(),name="content-report-create",),
    path("admin/overview/", AdminOverviewView.as_view(), name="admin-overview"),
    path("admin/users/", AdminUserListView.as_view(), name="admin-user-list"),
    path("admin/users/<int:pk>/", AdminUserDetailView.as_view(),name="admin-user-detail",),
    path("admin/users/<int:user_id>/suspend/",AdminSuspendUserView.as_view(),name="admin-user-suspend",),
    path("admin/users/<int:user_id>/unsuspend/",AdminUnsuspendUserView.as_view(),name="admin-user-unsuspend",),
    path("admin/analytics/users/",AdminUserAnalyticsView.as_view(), name="admin-user-analytics",),
    path("admin/posts/", AdminPostListView.as_view(), name="admin-post-list"),
    path("admin/posts/<int:post_id>/",AdminPostDeleteView.as_view(),name="admin-post-delete",),
    path("admin/comments/<int:comment_id>/",AdminCommentDeleteView.as_view(),name="admin-comment-delete",),
    path("admin/account-reports/",AdminAccountReportListView.as_view(),name="admin-account-report-list",),
    path("admin/account-reports/<int:pk>/", AdminAccountReportDetailView.as_view(),name="admin-account-report-detail",),
    path("admin/reports/",AdminContentReportListView.as_view(),name="admin-content-report-list",),
    path("admin/reports/<int:pk>/",AdminContentReportDetailView.as_view(),    name="admin-content-report-detail",),
]
