from django.urls import path


from .views import (
    MarkAllNotificationsReadView,
    MarkNotificationReadView,
    NotificationPreferencesView,
    NotificationListView,RegisterDeviceView
)


urlpatterns = [
    path(
        "preferences/",
        NotificationPreferencesView.as_view(),
        name="notification-preferences",
    ),

    path(
        "",
        NotificationListView.as_view(),
        name="notification-list",
    ),

    path(
        "<int:pk>/read/",
        MarkNotificationReadView.as_view(),
        name="notification-read",
    ),

    path(
        "read-all/",
        MarkAllNotificationsReadView.as_view(),
        name="notification-read-all",
    ),
    
    path(
        "devices/",
        RegisterDeviceView.as_view(),
        name="register-device",
    ),

]