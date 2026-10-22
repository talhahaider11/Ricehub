from django.contrib import admin

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


admin.site.register(
    [
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
    ]
)
