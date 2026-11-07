from rest_framework import serializers

from .models import PaymentRequest


class PaymentRequestSerializer(serializers.ModelSerializer):
    reference = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=120,
    )

    receipt = serializers.ImageField(
        write_only=True,
        required=False,
        allow_null=True,
    )

    class Meta:
        model = PaymentRequest
        fields = (
            "id",
            "kind",
            "method",
            "amount_pkr",
            "reference",
            "sender_name",
            "sender_phone",
            "transfer_app",
            "receipt",
            "status",
            "post",
            "created_at",
        )
        read_only_fields = ("id", "amount_pkr", "status", "created_at")

    def validate_sender_name(self, value):
        return value.strip()

    def validate_sender_phone(self, value):
        return value.strip()

    def validate_receipt(self, value):
        if value and value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("Receipt images must be 5 MB or smaller.")
        if value and value.name.rsplit(".", 1)[-1].lower() not in {
            "jpg",
            "jpeg",
            "png",
            "webp",
        }:
            raise serializers.ValidationError("Use a JPG, PNG, or WebP receipt image.")
        return value

    def validate_reference(self, value):
        value = value.strip()
        return value
