
from django.urls import path
from rest_framework_simplejwt.views import (
    TokenBlacklistView,
)

from .views import (
    AccountDeleteView,
    AccountExportView,
    AccountReportCreateView,
    BlockedUsersView,
    LoginView,
    MeView,
    MutedUserView,
    PasswordResetRequestView,
    ProfileUpdateView,
    RegisterView,
    ResendVerificationCodeView,
    SecuritySessionsView,
    SupportRequestCreateView,
    TwoFactorSettingsView,
    UserByUsernameView,
    UserDetailView,
    UsernameAvailabilityView,
    UserPrivacySettingsView,
    UserSearchView,
    VerifyEmailView,
    VerifyTwoFactorLoginView,
)
from .password_views import (
    PasswordChangeView,
    PasswordResetConfirmView as TokenPasswordResetConfirmView,
)
from .security_views import SecurityTokenRefreshView

from django.core.cache import cache
from django.contrib.auth import get_user_model
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

urlpatterns = [
    # Registration and email verification

    path("register/", RegisterView.as_view(), name="register"),
    path(
        "username-availability/",
        UsernameAvailabilityView.as_view(),
        name="username_availability",
    ),
    path("verify-email/", VerifyEmailView.as_view(), name="verify-email"),
    path(
        "resend-verification/",
        ResendVerificationCodeView.as_view(),
        name="resend-verification",
    ),

    # Login and JWT
    path("token/", LoginView.as_view(), name="token_obtain_pair"),
    path(
        "token/refresh/",
        SecurityTokenRefreshView.as_view(),
        name="token_refresh",
    ),
    path(
        "token/logout/",
        TokenBlacklistView.as_view(),
        name="token_blacklist",
    ),
    path(
        "verify-two-factor/",
        VerifyTwoFactorLoginView.as_view(),
        name="verify_two_factor",
    ),

    # Security and privacy
    path(
        "security/two-factor/",
        TwoFactorSettingsView.as_view(),
        name="two_factor_settings",
    ),
    path(
        "security/sessions/logout-all/",
        SecuritySessionsView.as_view(),
        name="logout_all_sessions",
    ),
    path("privacy/", UserPrivacySettingsView.as_view(), name="privacy_settings"),
    path("blocked-users/", BlockedUsersView.as_view(), name="blocked_users"),
    path(
        "blocked-users/<int:user_id>/",
        BlockedUsersView.as_view(),
        name="unblock_user",
    ),
    path("muted-users/<int:user_id>/", MutedUserView.as_view(), name="muted_user"),
    path("reports/accounts/", AccountReportCreateView.as_view(), name="account_report"),
    path("support/requests/", SupportRequestCreateView.as_view(), name="support_request"),
    path("account/export/", AccountExportView.as_view(), name="account_export"),
    path("account/delete/", AccountDeleteView.as_view(), name="account_delete"),

    # User endpoints
    path("me/", MeView.as_view(), name="me"),
    path("me/update/", ProfileUpdateView.as_view(), name="profile_update"),
    path("search/", UserSearchView.as_view(), name="user_search"),
    path("<int:id>/", UserDetailView.as_view(), name="user_detail"),
    path(
        "username/<str:username>/",
        UserByUsernameView.as_view(),
        name="user_by_username",
    ),

    # Password reset
    path(
        "password/change/",
        PasswordChangeView.as_view(),
        name="password_change",
    ),
    path(
        "password-reset/",
        PasswordResetRequestView.as_view(),
        name="password_reset_request",
    ),
    path(
        "password-reset/confirm/",
        TokenPasswordResetConfirmView.as_view(),
        name="password_reset_confirm",
    ),
]

User = get_user_model()

@api_view(['GET'])
@permission_classes([AllowAny])
def check_username(request):
    username = request.GET.get('username', '').strip()
    
    if not username:
        return Response({"detail": "Username parameter is required."}, status=status.HTTP_400_BAD_REQUEST)

    cache_key = f"user_check_{username.lower()}"
    try:
        is_taken = cache.get(cache_key)
    except Exception:
        is_taken = None

    if is_taken is None:
        is_taken = User.objects.filter(username__iexact=username).exists()
        try:
            cache.set(cache_key, is_taken, 60)
        except Exception:
            pass

    return Response({"available": not is_taken}, status=status.HTTP_200_OK)