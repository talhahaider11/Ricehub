from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import HttpResponse, JsonResponse
from django.urls import include, path

from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
)
from users.security_views import SecurityTokenRefreshView

from search.views import (
    ExploreView,
    HashtagDetailView,
    PostSearchView,
    TrendingHashtagsView,
    UserSuggestionsView,
)
from .health import health_check
from users.views import LoginView


def api_root(request):
    return JsonResponse({
        "status": "online",
        "app": "Rice Hub API",
        "admin": "/admin/",
        "docs": "/api/docs/",
        "health": "/api/health/",
    })


def favicon_view(request):
    return HttpResponse(status=204)


urlpatterns = [
    # Homepage
    path("", api_root, name="api-root"),

    # Favicon Fix (Stop 404 warnings in Render logs)
    path("favicon.ico", favicon_view, name="favicon"),

    # Django admin
    path("admin/", admin.site.urls),

    # User endpoints
    path(
        "api/users/suggestions/",
        UserSuggestionsView.as_view(),
        name="user-suggestions",
    ),
    path("api/users/", include("users.urls")),

    # Discovery endpoints
    path("api/posts/search/", PostSearchView.as_view(), name="post-search"),
    path(
        "api/hashtags/trending/",
        TrendingHashtagsView.as_view(),
        name="trending-hashtags",
    ),
    path(
        "api/hashtags/<str:tag>/",
        HashtagDetailView.as_view(),
        name="hashtag-detail",
    ),
    path("api/explore/", ExploreView.as_view(), name="explore"),
    path("api/", api_root, name="api-root"),
    path("api/posts/", include("posts.urls")),
    path("api/billing/", include("billing.urls")),
    path("api/media/", include("media_app.urls")),
    path("api/feed/", include("feed.urls")),
    path("api/stories/", include("stories.urls")),
    path("api/", include("comments.urls")),
    path("api/", include("reactions.urls")),
    path("api/friends/", include("friendships.urls")),
    path("api/messages/", include("messaging.urls")),
    path("api/notifications/", include("notifications.urls")),
    path("api/search/", include("search.urls")),
    path("api/community/", include("community.urls")),
    path("api/moderation/", include("moderation.urls")),
    path("api/admin/", include("administration.urls")),
    path("api/token/", LoginView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/",SecurityTokenRefreshView.as_view(),name="token_refresh",),
    path("api/auth/login/", LoginView.as_view(), name="auth-login"),
    path("api/auth/refresh/",SecurityTokenRefreshView.as_view(),name="auth-refresh",),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/",SpectacularSwaggerView.as_view(url_name="schema"),name="swagger-ui",),
    path("api/health/", health_check, name="api-health"),
    path("health/", health_check, name="health_check"),
]

if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT,
    )