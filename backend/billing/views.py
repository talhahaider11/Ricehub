from django.conf import settings
from django.db import IntegrityError, transaction
from rest_framework import status
from rest_framework.exceptions import ValidationError
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
            }
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
        else:
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
                )
        except IntegrityError as error:
            raise ValidationError(
                {"reference": "This transfer reference has already been submitted."}
            ) from error
        return Response(
            PaymentRequestSerializer(payment).data,
            status=status.HTTP_201_CREATED,
        )
