from django.urls import path

from .views import MediaAssetDeleteView, MediaUploadView


urlpatterns = [
    path("upload/", MediaUploadView.as_view(), name="media-upload"),
    path("<int:pk>/", MediaAssetDeleteView.as_view(), name="media-delete"),
]
