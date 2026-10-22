from django.urls import path

from .views import (
    CommunityListCreateView,
    CommunityMembershipView,
    CommunityPostDetailView,
    CommunityPostListCreateView,
    EventAttendanceView,
    EventDetailView,
    EventInvitationListCreateView,
    EventInvitationRespondView,
    EventInvitationInboxView,
    EventListCreateView,
    MarketplaceListingDetailView,
    MarketplaceListingListCreateView,
    MarketplaceOrderListCreateView,
    MarketplaceOrderStatusView,
    StoryListCreateView,
    StoryDetailView,
    StoryViewListCreateView,
)


urlpatterns = [
    path("stories/", StoryListCreateView.as_view(), name="story-list-create"),
    path("stories/<int:pk>/", StoryDetailView.as_view(), name="story-detail"),
    path(
        "stories/<int:story_id>/views/",
        StoryViewListCreateView.as_view(),
        name="story-views",
    ),
    path("communities/", CommunityListCreateView.as_view(), name="community-list-create"),
    path(
        "communities/<int:community_id>/membership/",
        CommunityMembershipView.as_view(),
        name="community-membership",
    ),
    path(
        "communities/<int:community_id>/posts/",
        CommunityPostListCreateView.as_view(),
        name="community-post-list-create",
    ),
    path(
        "community-posts/<int:pk>/",
        CommunityPostDetailView.as_view(),
        name="community-post-detail",
    ),
    path("events/", EventListCreateView.as_view(), name="event-list-create"),
    path("events/<int:pk>/", EventDetailView.as_view(), name="event-detail"),
    path(
        "event-invitations/",
        EventInvitationInboxView.as_view(),
        name="event-invitation-inbox",
    ),
    path(
        "events/<int:event_id>/attendance/",
        EventAttendanceView.as_view(),
        name="event-attendance",
    ),
    path(
        "events/<int:event_id>/invitations/",
        EventInvitationListCreateView.as_view(),
        name="event-invitation-list-create",
    ),
    path(
        "event-invitations/<int:invitation_id>/respond/",
        EventInvitationRespondView.as_view(),
        name="event-invitation-respond",
    ),
    path("marketplace/", MarketplaceListingListCreateView.as_view(), name="marketplace-list-create"),
    path("marketplace/<int:pk>/", MarketplaceListingDetailView.as_view(), name="marketplace-detail"),
    path(
        "marketplace/orders/",
        MarketplaceOrderListCreateView.as_view(),
        name="marketplace-order-list-create",
    ),
    path(
        "marketplace/orders/<int:order_id>/",
        MarketplaceOrderStatusView.as_view(),
        name="marketplace-order-status",
    ),
]
