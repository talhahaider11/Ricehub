from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import UserBlock

User = get_user_model()


class UserBlockSerializer(serializers.ModelSerializer):
    blocked_username = serializers.CharField(
        source="blocked.username",
        read_only=True,
    )

    class Meta:
        model = UserBlock
        fields = [
            "id",
            "blocked",
            "blocked_username",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
        ]

    def validate_blocked(self, value):
        request = self.context["request"]

        if value == request.user:
            raise serializers.ValidationError(
                "You cannot block yourself."
            )

        return value