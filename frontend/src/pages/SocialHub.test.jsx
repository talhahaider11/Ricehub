import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import SocialHub from "./SocialHub";
import communityService from "../services/communityService";

vi.mock("../hooks/useAuth", () => ({
  default: () => ({ user: { id: 7, is_verified: true } }),
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
    events: vi.fn(),
    invitations: vi.fn(),
    listings: vi.fn(),
    orders: vi.fn(),
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
    vi.clearAllMocks();
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
