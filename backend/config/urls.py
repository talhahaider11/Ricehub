from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import HttpResponse, JsonResponse
from django.urls import include, path

from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
)
from rest_framework_simplejwt.views import TokenRefreshView

from users.views import LoginView
from .health import health_check
from .views import HealthView


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
    path("api/users/", include("users.urls")),

    # API root
    path("api/", api_root, name="api-root"),

    # Posts
    path("api/posts/", include("posts.urls")),

    # Comments and reactions
    path("api/", include("comments.urls")),
    path("api/", include("reactions.urls")),

    # Friends, messages, notifications
    path("api/friends/", include("friendships.urls")),
    path("api/messages/", include("messaging.urls")),
    path("api/notifications/", include("notifications.urls")),

    # Search
    path("api/search/", include("search.urls")),

    # Community
    path("api/community/", include("community.urls")),

    # Authentication
    path("api/token/", LoginView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/login/", LoginView.as_view(), name="auth-login"),
    path("api/auth/refresh/", TokenRefreshView.as_view(), name="auth-refresh"),

    # API documentation
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),

    # Health checks
    path("api/health/", health_check, name="api-health"),
    path("health/", HealthView.as_view(), name="health"),
    path("health/", health_check, name="health_check"),
]

if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT,
    )