from django.urls import path

from .views import PaymentOptionsView, PaymentRequestListCreateView


urlpatterns = [
    path("options/", PaymentOptionsView.as_view(), name="billing-options"),
    path(
        "payment-requests/",
        PaymentRequestListCreateView.as_view(),
        name="payment-requests",
    ),
]
