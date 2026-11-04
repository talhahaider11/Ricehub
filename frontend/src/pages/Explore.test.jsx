import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Explore from "./Explore";
import friendService from "../services/friendService";
import searchService from "../services/searchService";
import useAuth from "../hooks/useAuth";

vi.mock("../services/friendService", () => ({
  default: { send: vi.fn() },
}));

vi.mock("../services/searchService", () => ({
  default: { explore: vi.fn() },
}));

vi.mock("../hooks/useAuth", () => ({
  default: vi.fn(),
}));

vi.mock("../components/posts/PostCard", () => ({
  default: ({ post }) => <article>{post.content}</article>,
}));

describe("Explore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: { id: 1 } });
    searchService.explore.mockResolvedValue({
      posts: [{ id: 4, content: "Explore post" }],
      pagination: { next: "https://api.example.test/api/explore/?page=2" },
      hashtags: [{ name: "trending", post_count: 2 }],
      suggested_users: [{ id: 8, username: "suggested" }],
    });
    searchService.explore.mockResolvedValueOnce({
      posts: [{ id: 4, content: "Explore post" }],
      pagination: { next: "https://api.example.test/api/explore/?page=2" },
      hashtags: [{ name: "trending", post_count: 2 }],
      suggested_users: [{ id: 8, username: "suggested" }],
    }).mockResolvedValueOnce({
      posts: [{ id: 5, content: "Second explore post" }],
      pagination: { next: null },
      hashtags: [{ name: "trending", post_count: 2 }],
      suggested_users: [],
    });
  });

  it("shows discovery content and sends friend requests", async () => {
    render(
      <MemoryRouter>
        <Explore />
      </MemoryRouter>
    );

    expect(await screen.findByText("Explore post")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /#trending/ })).toHaveAttribute(
      "href",
      "/hashtag/trending"
    );
    expect(screen.getByText("@suggested")).toBeInTheDocument();

    friendService.send.mockResolvedValue({});
    fireEvent.click(screen.getByRole("button", { name: "Add friend" }));

    await waitFor(() => expect(friendService.send).toHaveBeenCalledWith(8));
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Second explore post")).toBeInTheDocument();
    expect(searchService.explore).toHaveBeenLastCalledWith(2);
  }, 10000);
});
