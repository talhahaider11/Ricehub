import mimetypes
from uuid import uuid4

from django.conf import settings
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.db import IntegrityError, transaction
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAdminUser
from rest_framework.authentication import SessionAuthentication
from rest_framework.response import Response
from rest_framework.views import APIView

from config.permissions import IsActiveAndNotSuspended
from config.throttling import PostCreateRateThrottle
from posts.models import Post

from .models import PaymentRequest
from .services import SUBSCRIPTION_GRACE_DAYS
from .serializers import PaymentRequestSerializer


class PaymentOptionsView(APIView):
    permission_classes = [IsActiveAndNotSuspended]

    def get(self, request):
        return Response(
            {
                "automatic_billing": False,
                "subscription": {
                    "amount_pkr": "249.00",
                    "period_days": 30,
                    "grace_days": SUBSCRIPTION_GRACE_DAYS,
                },
                "boosts": [
                    {
                        "kind": PaymentRequest.Kind.BOOST_WEEK,
                        "amount_pkr": "149.00",
                        "amount_usd": "0.55",
                        "period_days": 7,
                    },
                    {
                        "kind": PaymentRequest.Kind.BOOST_MONTH,
                        "amount_pkr": "350.00",
                        "amount_usd": "1.25",
                        "period_days": 30,
                        "discounted": True,
                    },
                ],
                "methods": [
                    {"value": value, "label": label}
                    for value, label in PaymentRequest.Method.choices
                ],
                "instructions": getattr(settings, "PAYMENT_INSTRUCTIONS", ""),
                "sadapay": {
                    "account_name": getattr(settings, "SADAPAY_ACCOUNT_NAME", ""),
                    "account_number": getattr(settings, "SADAPAY_ACCOUNT_NUMBER", ""),
                    "qr_image_url": getattr(settings, "SADAPAY_QR_IMAGE_URL", ""),
                },
                "transfer_apps": [
                    {"value": value, "label": label}
                    for value, label in PaymentRequest.TransferApp.choices
                ],
                "review_window_hours": 24,
            }
        )


class AdminPaymentReceiptView(APIView):
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAdminUser]

    def get(self, request, payment_id):
        payment = get_object_or_404(PaymentRequest, pk=payment_id)
        if not payment.receipt:
            return Response(
                {"detail": "No receipt was uploaded for this payment request."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return FileResponse(
            payment.receipt.open("rb"),
            content_type=mimetypes.guess_type(payment.receipt.name)[0] or "application/octet-stream",
            as_attachment=False,
            filename="payment-receipt",
        )


class PaymentRequestListCreateView(APIView):
    permission_classes = [IsActiveAndNotSuspended]
    throttle_classes = [PostCreateRateThrottle]

    def get(self, request):
        payments = PaymentRequest.objects.filter(user=request.user)
        return Response(PaymentRequestSerializer(payments, many=True).data)

    def post(self, request):
        serializer = PaymentRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        kind = serializer.validated_data["kind"]
        post = serializer.validated_data.get("post")
        if kind == PaymentRequest.Kind.SUBSCRIPTION:
            if post:
                raise ValidationError({"post": "Subscription requests do not use a post."})
            if not request.user.is_email_verified or not request.user.is_phone_verified:
                raise ValidationError(
                    {"detail": "Verify your email and phone before requesting verification."}
                )
            if serializer.validated_data["method"] != PaymentRequest.Method.SADAPAY:
                raise ValidationError(
                    {"method": "Verification payments must be sent to the SadaPay account."}
                )
            required_fields = {
                "sender_name": "Enter the name on the sending account.",
                "sender_phone": "Enter the sender phone number.",
                "transfer_app": "Select the app used to send the transfer.",
                "receipt": "Upload the payment receipt image.",
            }
            missing = {
                field: message
                for field, message in required_fields.items()
                if not serializer.validated_data.get(field)
            }
            if missing:
                raise ValidationError(missing)
        else:
            if not serializer.validated_data.get("reference"):
                raise ValidationError(
                    {"reference": "Enter the transfer reference for a post boost."}
                )
            if not post:
                raise ValidationError({"post": "Select a post to boost."})
            if post.author_id != request.user.pk:
                raise ValidationError({"post": "You can only boost your own post."})
            if post.moderation_status != Post.ModerationStatus.APPROVED:
                raise ValidationError({"post": "Only approved posts can be boosted."})

        pending = PaymentRequest.objects.filter(
            user=request.user,
            kind=kind,
            post=post,
            status=PaymentRequest.Status.PENDING,
        ).first()
        if pending:
            return Response(
                PaymentRequestSerializer(pending).data,
                status=status.HTTP_200_OK,
            )

        try:
            with transaction.atomic():
                payment = serializer.save(
                    user=request.user,
                    amount_pkr=PaymentRequest.PRICES[kind],
                    reference=(
                        serializer.validated_data.get("reference")
                        or f"verification-{uuid4().hex}"
                    ),
                )
        except IntegrityError as error:
            raise ValidationError(
                {"reference": "This transfer reference has already been submitted."}
            ) from error
        return Response(
            PaymentRequestSerializer(payment).data,
            status=status.HTTP_201_CREATED,
        )
