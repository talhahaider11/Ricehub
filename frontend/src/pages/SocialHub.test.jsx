import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import SocialHub from "./SocialHub";
import communityService from "../services/communityService";
import friendService from "../services/friendService";

vi.mock("../hooks/useAuth", () => ({
  default: () => ({
    user: globalThis.__socialHubUser || { id: 7, is_verified: true },
  }),
}));

vi.mock("../services/communityService", () => ({
  default: {
    stories: vi.fn(),
    communities: vi.fn(),
    communityPosts: vi.fn(),
    createCommunityPost: vi.fn(),
    toggleCommunityPostLike: vi.fn(),
    communityPostComments: vi.fn(),
    createCommunityPostComment: vi.fn(),
    removeCommunityPost: vi.fn(),
    updateCommunity: vi.fn(),
    joinCommunity: vi.fn(),
    leaveCommunity: vi.fn(),
    communityMembers: vi.fn(),
    removeCommunityMember: vi.fn(),
    events: vi.fn(),
    createEvent: vi.fn(),
    updateEvent: vi.fn(),
    deleteEvent: vi.fn(),
    respondToEvent: vi.fn(),
    cancelEventResponse: vi.fn(),
    eventInterestedUsers: vi.fn(),
    invitations: vi.fn(),
    listings: vi.fn(),
    orders: vi.fn(),
  },
}));

vi.mock("../services/friendService", () => ({
  default: {
    list: vi.fn(),
  },
}));

function QueryNavigationButton() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate("/discover")}>
      Reset discover tab
    </button>
  );
}

describe("SocialHub route tabs", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    globalThis.__socialHubUser = {
      id: 7,
      is_verified: true,
      is_subscription_verified: true,
    };
  });

  it("resets to Stories when Discover opens without a stale tab query", async () => {
    communityService.listings.mockResolvedValue([]);
    communityService.orders.mockResolvedValue([]);
    communityService.stories.mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/discover?tab=Marketplace"]}>
        <QueryNavigationButton />
        <Routes>
          <Route path="/discover" element={<SocialHub />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("tab", { name: "Marketplace" }))
      .toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(communityService.listings).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Reset discover tab" }));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Stories" }))
        .toHaveAttribute("aria-selected", "true");
    });
    expect(communityService.stories).toHaveBeenCalled();
  });

  it("creates an event with optional end time and banner, then adds it to the list", async () => {
    communityService.events.mockResolvedValue([]);
    communityService.invitations.mockResolvedValue([]);
    friendService.list.mockResolvedValue([]);
    const createdEvent = {
      id: 99,
      title: "Community harvest",
      description: "Meet local growers",
      location: "Town Hall",
      starts_at: "2035-10-10T10:00:00.000Z",
      ends_at: "2035-10-10T12:00:00.000Z",
      banner: "https://cdn.example.test/event.png",
      host: { id: 7, username: "current-user" },
      interested_count: 0,
    };
    communityService.createEvent.mockResolvedValue(createdEvent);

    render(
      <MemoryRouter initialEntries={["/discover?tab=Events"]}>
        <Routes>
          <Route path="/discover" element={<SocialHub />} />
        </Routes>
      </MemoryRouter>
    );

    const title = await screen.findByPlaceholderText("Event name");
    fireEvent.change(title, { target: { value: createdEvent.title } });
    fireEvent.change(screen.getByPlaceholderText("Event details (optional)"), {
      target: { value: createdEvent.description },
    });
    fireEvent.change(screen.getByPlaceholderText("Location (optional)"), {
      target: { value: createdEvent.location },
    });
    const startField = screen.getByLabelText("Starts at");
    const endField = screen.getByLabelText("Ends at (optional)");
    fireEvent.change(startField, { target: { value: "2035-10-10T10:00" } });
    fireEvent.change(endField, { target: { value: "2035-10-10T12:00" } });
    const banner = new File(["image"], "banner.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Event banner (optional)"), {
      target: { files: [banner] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create event" }));

    await waitFor(() => {
      expect(communityService.createEvent).toHaveBeenCalledWith({
        title: createdEvent.title,
        description: createdEvent.description,
        location: createdEvent.location,
        starts_at: new Date(startField.value).toISOString(),
        ends_at: new Date(endField.value).toISOString(),
        banner,
      });
    });
    expect(await screen.findByRole("heading", {
      name: createdEvent.title,
    })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: createdEvent.title }))
      .toHaveAttribute("src", createdEvent.banner);
    expect(await screen.findByRole("status"))
      .toHaveTextContent("Event created.");
    expect(title).toHaveValue("");
    expect(endField).toHaveValue("");
  });

  it("keeps event browsing available but gates creation for expired verification", async () => {
    globalThis.__socialHubUser = {
      id: 7,
      is_verified: true,
      is_subscription_verified: false,
      subscription_expires_at: "2026-11-20T00:00:00.000Z",
    };
    communityService.events.mockResolvedValue([{
      id: 208,
      title: "Open community meetup",
      starts_at: "2035-10-10T10:00:00.000Z",
      banner: null,
      host: { id: 12, username: "event-host" },
      interested_count: 0,
      my_response: null,
    }]);
    communityService.invitations.mockResolvedValue([]);
    friendService.list.mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/discover?tab=Events"]}>
        <Routes>
          <Route path="/discover" element={<SocialHub />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", {
      name: "Verified Account Required",
    })).toBeInTheDocument();
    expect(screen.getByText(
      "First verify your account to create events or list items on the Marketplace."
    )).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Get Verified" }))
      .toHaveAttribute("href", "/billing");
    expect(screen.getByRole("heading", { name: "Open community meetup" }))
      .toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create event" }))
      .not.toBeInTheDocument();
  });

  it("keeps marketplace listings browsable but gates listing creation for unverified users", async () => {
    globalThis.__socialHubUser = { id: 7, is_verified: false };
    communityService.listings.mockResolvedValue([{
      id: 309,
      title: "Available to browse",
      description: "Existing marketplace listing",
      price: "100.00",
      location: "Town",
      seller: { id: 12, username: "seller" },
      status: "available",
      image: null,
    }]);
    communityService.orders.mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/discover?tab=Marketplace"]}>
        <Routes>
          <Route path="/discover" element={<SocialHub />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", {
      name: "Verified Account Required",
    })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Get Verified" }))
      .toHaveAttribute("href", "/billing");
    expect(screen.getByRole("heading", { name: "Available to browse" }))
      .toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish listing" }))
      .not.toBeInTheDocument();
  });

  it("opens interested users for the event host and links each profile", async () => {
    communityService.events.mockResolvedValue([{
      id: 21,
      title: "Community meetup",
      starts_at: "2035-10-10T10:00:00.000Z",
      banner: null,
      host: { id: 7, username: "current-user" },
      interested_count: 1,
      my_response: null,
    }]);
    communityService.invitations.mockResolvedValue([]);
    friendService.list.mockResolvedValue([]);
    communityService.eventInterestedUsers.mockResolvedValue({
      results: [{
        id: 12,
        username: "interested-member",
        full_name: "Interested Member",
        avatar: "https://cdn.example.test/member.png",
        is_verified: true,
      }],
    });

    render(
      <MemoryRouter initialEntries={["/discover?tab=Events"]}>
        <Routes>
          <Route path="/discover" element={<SocialHub />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "1 interested" }));

    expect(await screen.findByRole("dialog", { name: "Interested users" }))
      .toBeInTheDocument();
    expect(communityService.eventInterestedUsers).toHaveBeenCalledWith(21);
    expect(screen.getByRole("link", { name: /Interested Member/ }))
      .toHaveAttribute("href", "/profile/12");
    expect(screen.queryByRole("button", { name: "Going" })).not.toBeInTheDocument();
  });

  it("shows an empty state when an event has no interested users", async () => {
    communityService.events.mockResolvedValue([{
      id: 23,
      title: "New meetup",
      starts_at: "2035-10-10T10:00:00.000Z",
      banner: null,
      host: { id: 7, username: "current-user" },
      interested_count: 0,
      my_response: null,
    }]);
    communityService.invitations.mockResolvedValue([]);
    friendService.list.mockResolvedValue([]);
    communityService.eventInterestedUsers.mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/discover?tab=Events"]}>
        <Routes>
          <Route path="/discover" element={<SocialHub />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "0 interested" }));

    expect(await screen.findByText("No interested users yet."))
      .toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("optimistically toggles interest state, button label, and count", async () => {
    const event = {
      id: 24,
      title: "Interest toggle meetup",
      starts_at: "2035-10-10T10:00:00.000Z",
      banner: null,
      host: { id: 7, username: "current-user" },
      interested_count: 0,
      my_response: null,
      is_interested: false,
      interested_users: [],
    };
    const interestedEvent = {
      ...event,
      interested_count: 1,
      my_response: "interested",
      is_interested: true,
    };
    let resolveInterest;
    communityService.events
      .mockResolvedValueOnce([event])
      .mockResolvedValueOnce([interestedEvent])
      .mockResolvedValueOnce([event]);
    communityService.invitations.mockResolvedValue([]);
    friendService.list.mockResolvedValue([]);
    communityService.respondToEvent.mockImplementation(
      () => new Promise((resolve) => {
        resolveInterest = resolve;
      })
    );
    communityService.cancelEventResponse.mockResolvedValue();

    render(
      <MemoryRouter initialEntries={["/discover?tab=Events"]}>
        <Routes>
          <Route path="/discover" element={<SocialHub />} />
        </Routes>
      </MemoryRouter>
    );

    const eventHeading = await screen.findByRole("heading", {
      name: "Interest toggle meetup",
    });
    const eventCard = eventHeading.closest("article");
    const interestedButton = within(eventCard).getByRole("button", { name: "Interested" });
    fireEvent.click(interestedButton);

    expect(communityService.respondToEvent).toHaveBeenCalledWith(24, "interested");
    expect(await within(eventCard).findByRole("button", { name: "Uninterested" }))
      .toBeInTheDocument();
    expect(within(eventCard).getByRole("button", { name: "1 interested" })).toBeInTheDocument();

    resolveInterest({});
    await waitFor(() => expect(communityService.events).toHaveBeenCalledTimes(2));
    const uninterestedButton = await within(eventCard).findByRole("button", {
      name: "Uninterested",
    });
    await waitFor(() => expect(uninterestedButton).not.toBeDisabled());
    fireEvent.click(uninterestedButton);

    expect(await within(eventCard).findByRole("button", { name: "Interested" }))
      .toBeInTheDocument();
    expect(within(eventCard).getByRole("button", { name: "0 interested" })).toBeInTheDocument();
    expect(communityService.cancelEventResponse).toHaveBeenCalledWith(24);
  });

  it("lets event viewers open a direct chat with the host", async () => {
    communityService.events.mockResolvedValue([{
      id: 22,
      title: "Public meetup",
      starts_at: "2035-10-10T10:00:00.000Z",
      banner: null,
      host: { id: 12, username: "event-host" },
      interested_count: 0,
      my_response: null,
    }]);
    communityService.invitations.mockResolvedValue([]);
    friendService.list.mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/discover?tab=Events"]}>
        <Routes>
          <Route path="/discover" element={<SocialHub />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("link", { name: "Contact Host" }))
      .toHaveAttribute("href", "/messages?username=event-host");
  });

  it("shows a seller the buyer profile link and verification badge", async () => {
    communityService.listings.mockResolvedValue([]);
    communityService.orders.mockResolvedValue([{
      id: 51,
      listing_title: "Desk",
      status: "requested",
      seller: { id: 7, username: "current-user" },
      buyer: {
        id: 12,
        username: "marketplace-buyer",
        full_name: "Marketplace Buyer",
        profile_picture: null,
        is_verified: true,
      },
    }]);

    render(
      <MemoryRouter initialEntries={["/discover?tab=Marketplace"]}>
        <Routes>
          <Route path="/discover" element={<SocialHub />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(await screen.findByRole("textbox", { name: "Search listings" }), {
      target: { value: "buyer-profile-test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    const buyerLink = await screen.findByRole("link", { name: /Marketplace Buyer/ });
    expect(buyerLink).toHaveAttribute("href", "/profile/12");
    expect(screen.getByRole("link", { name: "View profile" }))
      .toHaveAttribute("href", "/profile/12");
    expect(screen.getByLabelText("Verified account")).toBeInTheDocument();
  });

  it("lets a page admin edit page details", async () => {
    communityService.communities.mockResolvedValue([{
      id: 12,
      owner: { id: 7, username: "current-user" },
      name: "Rice page",
      description: "Old description",
      kind: "page",
      visibility: "public",
      member_count: 1,
      membership_role: "admin",
    }]);
    communityService.updateCommunity.mockResolvedValue({});

    render(
      <MemoryRouter initialEntries={["/discover?tab=Groups%20%26%20Pages"]}>
        <Routes>
          <Route path="/discover" element={<SocialHub />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Edit page" }));
    fireEvent.change(screen.getAllByPlaceholderText("Name")[1], {
      target: { value: "Updated rice page" },
    });
    fireEvent.change(screen.getAllByPlaceholderText("Description (optional)")[1], {
      target: { value: "New description" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(communityService.updateCommunity).toHaveBeenCalledWith(
      12,
      {
        name: "Updated rice page",
        description: "New description",
        visibility: "public",
      }
    ));
  });

  it("lets a community admin view members and remove a regular member", async () => {
    communityService.communities.mockResolvedValue([{
      id: 35,
      owner: { id: 7, username: "current-user" },
      name: "Rice sellers",
      description: "",
      kind: "group",
      visibility: "public",
      member_count: 2,
      membership_role: "admin",
    }]);
    communityService.communityMembers.mockResolvedValue([
      {
        user_id: 7,
        username: "current-user",
        first_name: "Current",
        last_name: "User",
        role: "admin",
      },
      {
        user_id: 8,
        username: "seller-to-remove",
        first_name: "Seller",
        last_name: "Member",
        role: "member",
      },
    ]);
    communityService.removeCommunityMember.mockResolvedValue({});

    render(
      <MemoryRouter initialEntries={["/discover?tab=Groups%20%26%20Pages"]}>
        <Routes>
          <Route path="/discover" element={<SocialHub />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Rice sellers" }))
      .toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Manage members" }));
    await waitFor(() => expect(
      communityService.communityMembers
    ).toHaveBeenCalledWith(35));
    expect(await screen.findByText("Seller Member")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Remove @seller-to-remove" })
    );

    await waitFor(() => expect(
      communityService.removeCommunityMember
    ).toHaveBeenCalledWith(35, 8));
    expect(await screen.queryByText("Seller Member")).not.toBeInTheDocument();
  });

  it("opens a page's post manager and lets its verified owner publish", async () => {
    communityService.communities.mockResolvedValue([{
      id: 22,
      owner: { id: 7, username: "current-user" },
      name: "Verified owner's page",
      description: "",
      kind: "page",
      visibility: "public",
      member_count: 1,
      membership_role: "admin",
    }]);
    communityService.communityPosts.mockResolvedValue([]);
    communityService.createCommunityPost.mockResolvedValue({ id: 31 });

    render(
      <MemoryRouter initialEntries={["/discover?tab=Groups%20%26%20Pages"]}>
        <Routes>
          <Route path="/discover" element={<SocialHub />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", {
      name: "Verified owner's page",
    })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Manage posts" }));
    await waitFor(() => expect(communityService.communityPosts).toHaveBeenCalled());
    const composer = await screen.findByPlaceholderText("Write a post for members");
    fireEvent.change(composer, { target: { value: "Fresh rice available" } });
    fireEvent.click(screen.getByRole("button", { name: "Publish to page" }));

    await waitFor(() => expect(communityService.createCommunityPost).toHaveBeenCalledWith(
      22,
      "Fresh rice available"
    ));
  });

  it("lets non-members view public community posts without showing a post composer", async () => {
    communityService.communities.mockResolvedValue([{
      id: 19,
      owner: { id: 8, username: "page-owner" },
      name: "Public rice page",
      description: "",
      kind: "page",
      visibility: "public",
      member_count: 1,
      membership_role: null,
    }]);
    communityService.communityPosts.mockResolvedValue([{
      id: 21,
      author: { id: 8, username: "page-owner" },
      content: "Visible public post",
      image: null,
      likes_count: 0,
      comments_count: 0,
      is_liked: false,
    }]);
    communityService.toggleCommunityPostLike.mockResolvedValue({
      is_liked: true,
      likes_count: 1,
    });
    communityService.communityPostComments.mockResolvedValue([]);
    communityService.createCommunityPostComment.mockResolvedValue({
      id: 44,
      author: { id: 7, username: "current-user" },
      content: "Interested!",
    });

    render(
      <MemoryRouter initialEntries={["/discover?tab=Groups%20%26%20Pages"]}>
        <Routes>
          <Route path="/discover" element={<SocialHub />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "View posts" }));

    expect(await screen.findByText("Visible public post")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Write a post for members")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Like (0)" }));
    await waitFor(() => expect(communityService.toggleCommunityPostLike)
      .toHaveBeenCalledWith(21));
    fireEvent.click(screen.getByRole("button", { name: "Comment (0)" }));
    const commentBox = await screen.findByRole("textbox", { name: "Write a comment" });
    fireEvent.change(commentBox, { target: { value: "Interested!" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(communityService.createCommunityPostComment)
      .toHaveBeenCalledWith(21, "Interested!"));
  });
});
