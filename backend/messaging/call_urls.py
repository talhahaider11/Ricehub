from django.urls import path

from .views import CallInitiateView, IncomingCallsView


urlpatterns = [
    path("initiate/", CallInitiateView.as_view(), name="call-initiate"),
    path("incoming/", IncomingCallsView.as_view(), name="incoming-calls"),
]
