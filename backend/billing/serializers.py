from rest_framework import serializers

from .models import PaymentRequest


class PaymentRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentRequest
        fields = (
            "id",
            "kind",
            "method",
            "amount_pkr",
            "reference",
            "status",
            "post",
            "created_at",
        )
        read_only_fields = ("id", "amount_pkr", "status", "created_at")

    def validate_reference(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError(
                "Enter the transfer reference for manual review."
            )
        return value
