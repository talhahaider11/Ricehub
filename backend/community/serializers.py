from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers

from .models import (
    Community,
    CommunityMembership,
    CommunityPost,
    Event,
    EventAttendance,
    EventInvitation,
    MarketplaceListing,
    MarketplaceOrder,
    Story,
    StoryView,
)


User = get_user_model()


class MediaURLField(serializers.FileField):
    def to_representation(self, value):
        if not value:
            return None
        url = value.url
        request = self.context.get("request")
        return request.build_absolute_uri(url) if request else url


class StorySerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()
    media = MediaURLField(required=False, allow_empty_file=False)
    view_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Story
        fields = ["id", "author", "text", "media", "view_count", "created_at", "expires_at"]
        read_only_fields = ["id", "author", "created_at", "expires_at"]

    def get_author(self, obj):
        return {"id": obj.author_id, "username": obj.author.username}

    def validate(self, attrs):
        if not attrs.get("text", "").strip() and not attrs.get("media"):
            raise serializers.ValidationError("Add text or media to your story.")
        media = attrs.get("media")
        if media and media.size > 20 * 1024 * 1024:
            raise serializers.ValidationError({"media": "Story media must be 20 MB or less."})
        if media and getattr(media, "content_type", "") not in {
            "image/jpeg",
            "image/png",
            "image/webp",
            "video/mp4",
            "video/webm",
        }:
            raise serializers.ValidationError(
                {"media": "Use a JPEG, PNG, WebP, MP4 or WebM story."}
            )
        return attrs


class CommunitySerializer(serializers.ModelSerializer):
    owner = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()
    membership_role = serializers.SerializerMethodField()

    class Meta:
        model = Community
        fields = [
            "id", "owner", "name", "description", "kind", "visibility",
            "member_count", "membership_role", "created_at",
        ]
        read_only_fields = ["id", "owner", "member_count", "membership_role", "created_at"]

    def get_owner(self, obj):
        return {"id": obj.owner_id, "username": obj.owner.username}

    def get_member_count(self, obj):
        annotated_count = getattr(obj, "member_count", None)
        return annotated_count if annotated_count is not None else obj.memberships.count()

    def get_membership_role(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        return next(
            (membership.role for membership in obj.memberships.all()
             if membership.user_id == request.user.pk),
            None,
        )


class CommunityPostSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()
    image = MediaURLField(required=False, allow_empty_file=False)

    class Meta:
        model = CommunityPost
        fields = ["id", "community", "author", "content", "image", "created_at"]
        read_only_fields = ["id", "community", "author", "created_at"]

    def get_author(self, obj):
        return {"id": obj.author_id, "username": obj.author.username}

    def validate(self, attrs):
        content = attrs.get("content", "").strip()
        image = attrs.get("image")
        if not content and not image:
            raise serializers.ValidationError("Add text or an image.")
        if image:
            if image.size > 5 * 1024 * 1024:
                raise serializers.ValidationError({"image": "Image must be 5 MB or less."})
            if getattr(image, "content_type", "") not in {
                "image/jpeg", "image/png", "image/webp",
            }:
                raise serializers.ValidationError({"image": "Use a JPEG, PNG or WebP image."})
        attrs["content"] = content
        return attrs


class EventSerializer(serializers.ModelSerializer):
    host = serializers.SerializerMethodField()
    going_count = serializers.IntegerField(read_only=True)
    interested_count = serializers.IntegerField(read_only=True)
    my_response = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = [
            "id", "host", "community", "title", "description", "location",
            "starts_at", "going_count", "interested_count", "my_response",
            "created_at",
        ]
        read_only_fields = ["id", "host", "going_count", "interested_count", "my_response", "created_at"]

    def get_host(self, obj):
        return {"id": obj.host_id, "username": obj.host.username}

    def get_my_response(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        attendance = next(
            (entry for entry in obj.attendances.all() if entry.user_id == request.user.pk),
            None,
        )
        return attendance.response if attendance else None

    def validate_starts_at(self, value):
        if value <= timezone.now():
            raise serializers.ValidationError("Event start time must be in the future.")
        return value


class EventAttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventAttendance
        fields = ["id", "event", "response", "created_at"]
        read_only_fields = ["id", "event", "created_at"]


class EventInvitationSerializer(serializers.ModelSerializer):
    event_title = serializers.CharField(source="event.title", read_only=True)
    inviter = serializers.SerializerMethodField()

    class Meta:
        model = EventInvitation
        fields = ["id", "event", "event_title", "inviter", "status", "created_at"]
        read_only_fields = ["id", "event", "event_title", "inviter", "status", "created_at"]

    def get_inviter(self, obj):
        return {"id": obj.inviter_id, "username": obj.inviter.username}



class MarketplaceListingSerializer(serializers.ModelSerializer):
    seller = serializers.SerializerMethodField()

    class Meta:
        model = MarketplaceListing
        fields = [
            "id", "seller", "title", "description", "price", "location",
            "image", "status", "created_at",
        ]
        read_only_fields = ["id", "seller", "created_at"]

    def get_seller(self, obj):
        return {"id": obj.seller_id, "username": obj.seller.username}

    def validate_image(self, value):
        if value and value.size > 10 * 1024 * 1024:
            raise serializers.ValidationError("Listing images must be 10 MB or less.")
        if value and getattr(value, "content_type", "") not in {
            "image/jpeg", "image/png", "image/webp",
        }:
            raise serializers.ValidationError("Use a JPEG, PNG or WebP image.")
        return value


class MarketplaceOrderSerializer(serializers.ModelSerializer):
    buyer = serializers.SerializerMethodField()
    seller = serializers.SerializerMethodField()
    listing_title = serializers.CharField(source="listing.title", read_only=True)

    class Meta:
        model = MarketplaceOrder
        fields = ["id", "listing", "listing_title", "buyer", "seller", "status", "created_at", "updated_at"]
        read_only_fields = ["id", "listing_title", "buyer", "status", "created_at", "updated_at"]

    def get_buyer(self, obj):
        return {"id": obj.buyer_id, "username": obj.buyer.username}

    def get_seller(self, obj):
        seller = obj.listing.seller
        return {"id": seller.pk, "username": seller.username}


class StoryViewSerializer(serializers.ModelSerializer):
    viewer = serializers.SerializerMethodField()

    class Meta:
        model = StoryView
        fields = ["id", "viewer", "viewed_at"]
        read_only_fields = fields

    def get_viewer(self, obj):
        return {"id": obj.viewer_id, "username": obj.viewer.username}
