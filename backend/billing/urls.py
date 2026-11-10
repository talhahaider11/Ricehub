from django.urls import path

from .views import (
    AdminPaymentReceiptView,
    PaymentOptionsView,
    PaymentRequestListCreateView,
)


urlpatterns = [
    path("options/", PaymentOptionsView.as_view(), name="billing-options"),
    path("admin/payment-requests/<int:payment_id>/receipt/",AdminPaymentReceiptView.as_view(),name="admin-payment-receipt",),
    path("payment-requests/",PaymentRequestListCreateView.as_view(),name="payment-requests",),
]
