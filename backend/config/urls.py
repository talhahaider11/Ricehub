from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework_simplejwt.views import TokenRefreshView
from users.views import LoginView
from .health import health_check
from .views import HealthView

urlpatterns = [
    path("admin/", admin.site.urls),
    # path("api/", include("api.urls")),
    path("api/users/", include("users.urls")),
    path("api/posts/", include("posts.urls")),
    path("api/", include("comments.urls")),
    path("api/", include("reactions.urls")),
    path("api/friends/", include("friendships.urls")),
    path("api/messages/", include("messaging.urls")),
    path("api/notifications/", include("notifications.urls")),
    path("api/search/", include("search.urls")),
    path("api/community/", include("community.urls")),
    path("api/token/", LoginView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/",SpectacularSwaggerView.as_view(url_name="schema"),name="swagger-ui",),
    path("api/auth/login/", LoginView.as_view()),
    path("api/auth/refresh/", TokenRefreshView.as_view()),
    path("api/health/", health_check),
    path("health/", HealthView.as_view(), name="health"),
]
if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT,
    )
