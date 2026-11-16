import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import SocialHub from "./SocialHub";
import communityService from "../services/communityService";

vi.mock("../hooks/useAuth", () => ({
  default: () => ({ user: { id: 7 } }),
}));

vi.mock("../services/communityService", () => ({
  default: {
    stories: vi.fn(),
    communities: vi.fn(),
    communityPosts: vi.fn(),
    createCommunityPost: vi.fn(),
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
    }]);

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
  });
});
