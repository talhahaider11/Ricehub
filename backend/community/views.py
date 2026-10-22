from django.db.models import Count, Prefetch, Q
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from users.privacy import get_blocked_user_ids
from notifications.models import Notification
from notifications.services import create_notification
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
from .serializers import (
    CommunitySerializer,
    CommunityPostSerializer,
    EventAttendanceSerializer,
    EventInvitationSerializer,
    EventSerializer,
    MarketplaceListingSerializer,
    MarketplaceOrderSerializer,
    StorySerializer,
    StoryViewSerializer,
)


class StoryListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = StorySerializer

    def get_queryset(self):
        return Story.objects.filter(
            expires_at__gt=timezone.now(),
        ).exclude(author_id__in=get_blocked_user_ids(self.request.user)).select_related(
            "author",
        ).annotate(view_count=Count("views", distinct=True)).order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


class CommunityListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CommunitySerializer

    def get_queryset(self):
        return Community.objects.annotate(
            member_count=Count("memberships", distinct=True),
        ).filter(
            Q(visibility=Community.Visibility.PUBLIC)
            | Q(memberships__user=self.request.user)
        ).exclude(
            owner_id__in=get_blocked_user_ids(self.request.user),
        ).distinct().prefetch_related("memberships__user")

    def perform_create(self, serializer):
        with transaction.atomic():
            community = serializer.save(owner=self.request.user)
            CommunityMembership.objects.create(
                community=community,
                user=self.request.user,
                role=CommunityMembership.Role.ADMIN,
            )


class CommunityMembershipView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, community_id):
        community = get_object_or_404(Community, pk=community_id)
        if community.owner_id in get_blocked_user_ids(request.user):
            raise PermissionDenied("This community is unavailable.")
        if community.visibility == Community.Visibility.PRIVATE:
            return Response(
                {"detail": "This community is private."},
                status=status.HTTP_403_FORBIDDEN,
            )
        membership, created = CommunityMembership.objects.get_or_create(
            community=community,
            user=request.user,
        )
        return Response(
            {"member": True, "role": membership.role},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request, community_id):
        community = get_object_or_404(Community, pk=community_id)
        membership = CommunityMembership.objects.filter(
            community=community,
            user=request.user,
        ).first()
        if membership and membership.role == CommunityMembership.Role.ADMIN:
            return Response(
                {"detail": "The owner/admin cannot leave their community."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if membership:
            membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CommunityPostListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CommunityPostSerializer

    def get_queryset(self):
        community = get_object_or_404(Community, pk=self.kwargs["community_id"])
        if not CommunityMembership.objects.filter(
            community=community,
            user=self.request.user,
        ).exists():
            raise PermissionDenied("Join this community to view its posts.")
        return CommunityPost.objects.filter(
            community=community,
        ).exclude(
            author_id__in=get_blocked_user_ids(self.request.user),
        ).select_related("author", "community")

    def perform_create(self, serializer):
        community = get_object_or_404(Community, pk=self.kwargs["community_id"])
        if not CommunityMembership.objects.filter(
            community=community,
            user=self.request.user,
        ).exists():
            raise PermissionDenied("Join this community before posting.")
        if community.owner_id in get_blocked_user_ids(self.request.user):
            raise PermissionDenied("This community is unavailable.")
        serializer.save(community=community, author=self.request.user)


class CommunityPostDetailView(generics.DestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CommunityPostSerializer
    queryset = CommunityPost.objects.select_related("community", "author")

    def get_object(self):
        post = super().get_object()
        is_admin = CommunityMembership.objects.filter(
            community=post.community,
            user=self.request.user,
            role=CommunityMembership.Role.ADMIN,
        ).exists()
        if post.author_id != self.request.user.pk and not is_admin:
            raise PermissionDenied("Only the author or a community admin can remove this post.")
        if post.author_id in get_blocked_user_ids(self.request.user):
            raise PermissionDenied("This post is unavailable.")
        return post


class StoryViewListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, story_id):
        story = get_object_or_404(
            Story.objects.filter(expires_at__gt=timezone.now()),
            pk=story_id,
        )
        if story.author_id == request.user.pk:
            return Response(
                {"detail": "You cannot count your own story as a view."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if story.author_id in get_blocked_user_ids(request.user):
            raise PermissionDenied("This story is unavailable.")
        view, _ = StoryView.objects.get_or_create(story=story, viewer=request.user)
        return Response(StoryViewSerializer(view).data, status=status.HTTP_201_CREATED)

    def get(self, request, story_id):
        story = get_object_or_404(Story, pk=story_id)
        if story.author_id != request.user.pk:
            raise PermissionDenied("Only the story owner can see its viewers.")
        views = story.views.exclude(
            viewer_id__in=get_blocked_user_ids(request.user),
        ).select_related("viewer").order_by("-viewed_at")
        return Response(StoryViewSerializer(views, many=True).data)


class StoryDetailView(generics.DestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = StorySerializer
    queryset = Story.objects.all()

    def get_object(self):
        story = super().get_object()
        if story.author_id != self.request.user.pk:
            raise PermissionDenied("You can only delete your own story.")
        return story


class EventListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = EventSerializer

    def get_queryset(self):
        return Event.objects.filter(
            starts_at__gte=timezone.now(),
        ).exclude(
            host_id__in=get_blocked_user_ids(self.request.user),
        ).annotate(
            going_count=Count(
                "attendances",
                filter=Q(attendances__response=Event.Response.GOING),
                distinct=True,
            ),
            interested_count=Count(
                "attendances",
                filter=Q(attendances__response=Event.Response.INTERESTED),
                distinct=True,
            ),
        ).select_related("host", "community").prefetch_related(
            Prefetch("attendances", queryset=EventAttendance.objects.filter(user=self.request.user))
        )

    def perform_create(self, serializer):
        community = serializer.validated_data.get("community")
        if community and not CommunityMembership.objects.filter(
            community=community,
            user=self.request.user,
        ).exists():
            raise PermissionDenied("Join a community before creating its event.")
        serializer.save(host=self.request.user)


class EventDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = EventSerializer
    queryset = Event.objects.select_related("host", "community")

    def get_queryset(self):
        return super().get_queryset().filter(
            starts_at__gte=timezone.now(),
        ).exclude(
            host_id__in=get_blocked_user_ids(self.request.user),
        )

    def perform_update(self, serializer):
        if self.get_object().host_id != self.request.user.pk:
            raise PermissionDenied("Only the host can update this event.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.host_id != self.request.user.pk:
            raise PermissionDenied("Only the host can delete this event.")
        instance.delete()


class EventAttendanceView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, event_id):
        event = get_object_or_404(Event, pk=event_id)
        serializer = EventAttendanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        attendance, _ = EventAttendance.objects.update_or_create(
            event=event,
            user=request.user,
            defaults={"response": serializer.validated_data["response"]},
        )
        return Response(EventAttendanceSerializer(attendance).data)

    def delete(self, request, event_id):
        EventAttendance.objects.filter(event_id=event_id, user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class EventInvitationListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = EventInvitationSerializer

    def get_queryset(self):
        return EventInvitation.objects.filter(
            invitee=self.request.user,
        ).select_related("event", "inviter")

    def create(self, request, *args, **kwargs):
        event = get_object_or_404(Event, pk=kwargs["event_id"])
        if event.host_id != request.user.pk:
            raise PermissionDenied("Only the event host can invite attendees.")
        invitee_id = request.data.get("user_id")
        if not invitee_id:
            return Response(
                {"detail": "user_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from django.contrib.auth import get_user_model
        from friendships.services import get_friend_ids

        User = get_user_model()
        invitee = get_object_or_404(User, pk=invitee_id)
        if invitee.pk == request.user.pk or invitee.pk not in get_friend_ids(request.user):
            raise PermissionDenied("Events can only be invited to your friends.")
        if invitee.pk in get_blocked_user_ids(request.user):
            raise PermissionDenied("This invitation is unavailable.")
        invitation, created = EventInvitation.objects.get_or_create(
            event=event,
            invitee=invitee,
            defaults={"inviter": request.user},
        )
        if created:
            create_notification(
                recipient=invitee,
                sender=request.user,
                notification_type=Notification.NotificationType.EVENT_INVITATION,
                message=f"{request.user.username} invited you to {event.title}.",
            )
        return Response(
            EventInvitationSerializer(invitation).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class EventInvitationRespondView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, invitation_id):
        invitation = get_object_or_404(
            EventInvitation.objects.select_related("event"),
            pk=invitation_id,
            invitee=request.user,
        )
        response_choice = request.data.get("response")
        if response_choice not in {
            EventInvitation.Status.ACCEPTED,
            EventInvitation.Status.DECLINED,
        }:
            return Response(
                {"detail": "Response must be accepted or declined."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        invitation.status = response_choice
        invitation.save(update_fields=["status"])
        if response_choice == EventInvitation.Status.ACCEPTED:
            EventAttendance.objects.update_or_create(
                event=invitation.event,
                user=request.user,
                defaults={"response": Event.Response.GOING},
            )
        return Response(EventInvitationSerializer(invitation).data)


class EventInvitationInboxView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = EventInvitationSerializer

    def get_queryset(self):
        return EventInvitation.objects.filter(
            invitee=self.request.user,
            status=EventInvitation.Status.PENDING,
            event__starts_at__gte=timezone.now(),
        ).exclude(
            inviter_id__in=get_blocked_user_ids(self.request.user),
        ).select_related("event", "inviter")


class MarketplaceListingListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = MarketplaceListingSerializer

    def get_queryset(self):
        queryset = MarketplaceListing.objects.select_related("seller")
        status_filter = self.request.query_params.get("status", "available")
        if status_filter not in MarketplaceListing.Status.values:
            raise PermissionDenied("Invalid listing status filter.")
        queryset = queryset.filter(status=status_filter).exclude(
            seller_id__in=get_blocked_user_ids(self.request.user),
        )
        query = self.request.query_params.get("q", "").strip()
        if query:
            queryset = queryset.filter(Q(title__icontains=query) | Q(description__icontains=query))
        return queryset

    def perform_create(self, serializer):
        serializer.save(seller=self.request.user)


class MarketplaceListingDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = MarketplaceListingSerializer
    queryset = MarketplaceListing.objects.select_related("seller")

    def get_object(self):
        listing = super().get_object()
        if listing.seller_id in get_blocked_user_ids(self.request.user):
            raise PermissionDenied("This listing is unavailable.")
        return listing

    def perform_update(self, serializer):
        if self.get_object().seller_id != self.request.user.pk:
            raise PermissionDenied("You can only update your own listing.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.seller_id != self.request.user.pk:
            raise PermissionDenied("You can only delete your own listing.")
        if instance.orders.exists():
            raise PermissionDenied("Listings with order history cannot be deleted; mark them sold.")
        instance.delete()


class MarketplaceOrderListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = MarketplaceOrderSerializer

    def get_queryset(self):
        return MarketplaceOrder.objects.filter(
            Q(buyer=self.request.user) | Q(listing__seller=self.request.user)
        ).exclude(
            buyer_id__in=get_blocked_user_ids(self.request.user),
        ).exclude(
            listing__seller_id__in=get_blocked_user_ids(self.request.user),
        ).select_related("buyer", "listing", "listing__seller")

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        listing = get_object_or_404(
            MarketplaceListing.objects.select_for_update(),
            pk=request.data.get("listing"),
        )
        if listing.seller_id == request.user.pk:
            raise PermissionDenied("You cannot request your own listing.")
        if listing.seller_id in get_blocked_user_ids(request.user):
            raise PermissionDenied("This listing is unavailable.")
        if listing.status != MarketplaceListing.Status.AVAILABLE:
            return Response(
                {"detail": "This listing is no longer available."},
                status=status.HTTP_409_CONFLICT,
            )
        existing = MarketplaceOrder.objects.filter(
            listing=listing,
            buyer=request.user,
            status__in=[
                MarketplaceOrder.Status.REQUESTED,
                MarketplaceOrder.Status.ACCEPTED,
            ],
        ).first()
        if existing:
            return Response(
                MarketplaceOrderSerializer(existing).data,
                status=status.HTTP_200_OK,
            )
        order = MarketplaceOrder.objects.create(
            listing=listing,
            buyer=request.user,
        )
        return Response(
            MarketplaceOrderSerializer(order).data,
            status=status.HTTP_201_CREATED,
        )


class MarketplaceOrderStatusView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def patch(self, request, order_id):
        order = get_object_or_404(
            MarketplaceOrder.objects.select_for_update().select_related("listing"),
            pk=order_id,
        )
        if (
            order.listing.seller_id in get_blocked_user_ids(request.user)
            or order.buyer_id in get_blocked_user_ids(request.user)
        ):
            raise PermissionDenied("This order is unavailable.")
        next_status = request.data.get("status")
        allowed_statuses = {
            MarketplaceOrder.Status.ACCEPTED,
            MarketplaceOrder.Status.DECLINED,
            MarketplaceOrder.Status.COMPLETED,
            MarketplaceOrder.Status.CANCELLED,
        }
        if next_status not in allowed_statuses:
            return Response(
                {"detail": "Choose an allowed order status."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        is_seller = order.listing.seller_id == request.user.pk
        is_buyer = order.buyer_id == request.user.pk
        if next_status in {
            MarketplaceOrder.Status.ACCEPTED,
            MarketplaceOrder.Status.DECLINED,
            MarketplaceOrder.Status.COMPLETED,
        } and not is_seller:
            raise PermissionDenied("Only the seller can set this status.")
        if next_status == MarketplaceOrder.Status.CANCELLED and not is_buyer:
            raise PermissionDenied("Only the buyer can cancel this request.")
        if next_status in {
            MarketplaceOrder.Status.ACCEPTED,
            MarketplaceOrder.Status.DECLINED,
        } and order.status != MarketplaceOrder.Status.REQUESTED:
            return Response(
                {"detail": "Only pending requests can be accepted or declined."},
                status=status.HTTP_409_CONFLICT,
            )
        if next_status == MarketplaceOrder.Status.COMPLETED and (
            order.status != MarketplaceOrder.Status.ACCEPTED
        ):
            return Response(
                {"detail": "Only accepted requests can be completed."},
                status=status.HTTP_409_CONFLICT,
            )
        if next_status == MarketplaceOrder.Status.CANCELLED and (
            order.status != MarketplaceOrder.Status.REQUESTED
        ):
            return Response(
                {"detail": "Only pending requests can be cancelled."},
                status=status.HTTP_409_CONFLICT,
            )
        if (
            next_status == MarketplaceOrder.Status.ACCEPTED
            and order.listing.status != MarketplaceListing.Status.AVAILABLE
        ):
            return Response(
                {"detail": "This listing is no longer available."},
                status=status.HTTP_409_CONFLICT,
            )
        order.status = next_status
        order.save(update_fields=["status", "updated_at"])
        if next_status == MarketplaceOrder.Status.ACCEPTED:
            order.listing.status = MarketplaceListing.Status.SOLD
            order.listing.save(update_fields=["status"])
            MarketplaceOrder.objects.filter(
                listing=order.listing,
                status=MarketplaceOrder.Status.REQUESTED,
            ).exclude(pk=order.pk).update(
                status=MarketplaceOrder.Status.DECLINED,
                updated_at=timezone.now(),
            )
        return Response(MarketplaceOrderSerializer(order).data)
