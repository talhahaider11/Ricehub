from django.db import IntegrityError, transaction
from rest_framework import serializers

from comments.models import Comment
from posts.models import Post
from users.models import AccountReport, User
from users.privacy import (
    can_view_post,
    get_blocked_user_ids,
    get_muted_user_ids,
)

from .models import ContentReport


class ContentReportCreateSerializer(serializers.ModelSerializer):
    target_id = serializers.IntegerField(min_value=1)

    class Meta:
        model = ContentReport
        fields = ("target_type", "target_id", "reason", "details")

    def validate(self, attrs):
        request = self.context["request"]
        target_type = attrs["target_type"]
        target_id = attrs["target_id"]

        if target_type == ContentReport.TargetType.POST:
            target = (
                Post.objects.select_related("author")
                .filter(pk=target_id)
                .first()
            )
            if target is None:
                raise serializers.ValidationError(
                    {"target_id": "The reported post does not exist."}
                )
            post = target
            author = target.author
        else:
            target = (
                Comment.objects.select_related("author", "post__author")
                .filter(pk=target_id)
                .first()
            )
            if target is None:
                raise serializers.ValidationError(
                    {"target_id": "The reported comment does not exist."}
                )
            post = target.post
            author = target.author

        if author.pk == request.user.pk:
            raise serializers.ValidationError(
                {"target_id": "You cannot report your own content."}
            )

        hidden_user_ids = (
            get_blocked_user_ids(request.user)
            | get_muted_user_ids(request.user)
        )
        if author.pk in hidden_user_ids or post.author_id in hidden_user_ids:
            raise serializers.ValidationError(
                {"target_id": "This content is unavailable."}
            )

        if not can_view_post(request.user, post):
            raise serializers.ValidationError(
                {"target_id": "This content is unavailable."}
            )

        duplicate = ContentReport.objects.filter(
            reporter=request.user,
            target_type=target_type,
            target_id=target_id,
        ).exists()
        if duplicate:
            raise serializers.ValidationError(
                {"target_id": "You have already reported this content."}
            )

        attrs["target"] = target
        return attrs

    def create(self, validated_data):
        target = validated_data.pop("target")
        target_type = validated_data["target_type"]
        if target_type == ContentReport.TargetType.POST:
            validated_data["post"] = target
            target_text = target.content
        else:
            validated_data["comment"] = target
            target_text = target.content

        validated_data.update(
            reporter=self.context["request"].user,
            target_author=target.author,
            target_text=target_text,
        )
        try:
            with transaction.atomic():
                return ContentReport.objects.create(**validated_data)
        except IntegrityError as error:
            raise serializers.ValidationError(
                {"target_id": "You have already reported this content."}
            ) from error


class AdminContentReportSerializer(serializers.ModelSerializer):
    reporter_username = serializers.CharField(
        source="reporter.username",
        read_only=True,
    )
    target_author_username = serializers.CharField(
        source="target_author.username",
        read_only=True,
        allow_null=True,
    )
    reviewed_by_username = serializers.CharField(
        source="reviewed_by.username",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = ContentReport
        fields = (
            "id",
            "reporter_username",
            "target_type",
            "target_id",
            "target_author_username",
            "reviewed_by_username",
            "target_text",
            "reason",
            "details",
            "status",
            "resolution_note",
            "reviewed_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class ContentReportReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContentReport
        fields = ("status", "resolution_note")


class AdminAccountReportSerializer(serializers.ModelSerializer):
    reporter_username = serializers.CharField(
        source="reporter.username",
        read_only=True,
    )
    reported_username = serializers.CharField(
        source="reported_user.username",
        read_only=True,
    )

    class Meta:
        model = AccountReport
        fields = (
            "id",
            "reporter_username",
            "reported_username",
            "reason",
            "details",
            "status",
            "moderator_notes",
            "reviewed_at",
            "created_at",
        )
        read_only_fields = (
            "id",
            "reporter_username",
            "reported_username",
            "reason",
            "details",
            "reviewed_at",
            "created_at",
        )


class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "is_active",
            "is_staff",
            "is_superuser",
            "is_suspended",
            "suspended_until",
            "suspension_reason",
            "created_at",
        )
        read_only_fields = fields


class AdminUserDetailSerializer(AdminUserSerializer):
    post_count = serializers.IntegerField(read_only=True)
    friend_count = serializers.SerializerMethodField()
    last_login = serializers.DateTimeField(read_only=True, allow_null=True)

    class Meta(AdminUserSerializer.Meta):
        fields = AdminUserSerializer.Meta.fields + (
            "date_joined",
            "last_login",
            "post_count",
            "friend_count",
        )

    def get_friend_count(self, user):
        return (
            user.accepted_sent_friend_count
            + user.accepted_received_friend_count
        )


class SuspendUserSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=500, trim_whitespace=True)

    def validate_reason(self, value):
        if not value:
            raise serializers.ValidationError("A suspension reason is required.")
        return value


class AdminAccountReportReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccountReport
        fields = ("status", "moderator_notes")
