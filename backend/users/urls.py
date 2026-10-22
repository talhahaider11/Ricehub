from django.urls import path

from rest_framework_simplejwt.views import (
    TokenBlacklistView,
    TokenRefreshView,
)

from .password_views import PasswordResetConfirmView as TokenPasswordResetConfirmView
from .views import (
    LoginView,
    MeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    ProfileUpdateView,
    RegisterView,
    ResendVerificationCodeView,
    UserPrivacySettingsView,
    TwoFactorSettingsView,
    VerifyTwoFactorLoginView,
    BlockedUsersView,
    SecuritySessionsView,
    AccountExportView,
    AccountDeleteView,
    UserByUsernameView,
    UserDetailView,
    UserSearchView,
    VerifyEmailView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("verify-email/", VerifyEmailView.as_view(), name="verify-email"),
    path("resend-verification/", ResendVerificationCodeView.as_view(), name="resend-verification"),
    path("token/", LoginView.as_view(), name="token"),
    path("verify-two-factor/", VerifyTwoFactorLoginView.as_view(), name="verify-two-factor"),
    path("security/two-factor/", TwoFactorSettingsView.as_view(), name="two-factor-settings"),
    path("privacy/", UserPrivacySettingsView.as_view(), name="privacy-settings"),
    path("blocked-users/", BlockedUsersView.as_view(), name="blocked-users"),
    path("blocked-users/<int:user_id>/", BlockedUsersView.as_view(), name="unblock-user"),
    path("security/sessions/logout-all/", SecuritySessionsView.as_view(), name="logout-all-sessions"),
    path("account/export/", AccountExportView.as_view(), name="account-export"),
    path("account/delete/", AccountDeleteView.as_view(), name="account-delete"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("token/logout/", TokenBlacklistView.as_view(), name="token-blacklist"),
    path("me/", MeView.as_view(), name="me"),
    path("me/update/", ProfileUpdateView.as_view(), name="profile-update"),
    path("search/", UserSearchView.as_view(), name="user-search"),
    path("<int:id>/", UserDetailView.as_view(), name="user-detail"),
    path("username/<str:username>/", UserByUsernameView.as_view(), name="user-by-username"),
    path("password-reset/", PasswordResetRequestView.as_view(), name="password-reset"),
    path(
        "password-reset/confirm/",
        TokenPasswordResetConfirmView.as_view(),
        name="password-reset-confirm",
    ),
]