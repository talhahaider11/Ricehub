
from django.urls import path
from rest_framework_simplejwt.views import (
    TokenBlacklistView,
    TokenRefreshView,
)

from .views import (
    AccountDeleteView,
    AccountExportView,
    BlockedUsersView,
    LoginView,
    MeView,
    PasswordResetRequestView,
    ProfileUpdateView,
    RegisterView,
    ResendVerificationCodeView,
    SecuritySessionsView,
    TwoFactorSettingsView,
    UserByUsernameView,
    UserDetailView,
    UserPrivacySettingsView,
    UserSearchView,
    VerifyEmailView,
    VerifyTwoFactorLoginView,
)
from .password_views import (
    PasswordResetConfirmView as TokenPasswordResetConfirmView,
)

urlpatterns = [
    # Registration and email verification
    path("register/", RegisterView.as_view(), name="register"),
    path("verify-email/", VerifyEmailView.as_view(), name="verify-email"),
    path(
        "resend-verification/",
        ResendVerificationCodeView.as_view(),
        name="resend-verification",
    ),

    # Login and JWT
    path("token/", LoginView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
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
