import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ForYou from "./ForYou";
import { getForYouFeed } from "../services/feedService";
import useAuth from "../hooks/useAuth";

vi.mock("../services/feedService", () => ({
  getForYouFeed: vi.fn(),
}));

vi.mock("../hooks/useAuth", () => ({
  default: vi.fn(),
}));

vi.mock("../components/posts/PostCard", () => ({
  default: ({ post }) => <article>{post.content}</article>,
}));

vi.mock("../components/common/InfiniteLoader", () => ({
  default: ({ onLoadMore, hasMore }) => hasMore
    ? <button type="button" onClick={onLoadMore}>Load more posts</button>
    : null,
}));

describe("For You page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: { id: 1 } });
    getForYouFeed.mockResolvedValueOnce({
      results: [{ id: 1, content: "First ranked post" }],
      next: "https://api.example.test/api/feed/for-you/?cursor=next-token",
    }).mockResolvedValueOnce({
      results: [{ id: 2, content: "Next ranked post" }],
      next: null,
    });
  });

  it("loads ranked posts and requests the next cursor page", async () => {
    render(
      <MemoryRouter>
        <ForYou />
      </MemoryRouter>
    );

    expect(await screen.findByText("First ranked post")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Load more posts" }));
    expect(await screen.findByText("Next ranked post")).toBeInTheDocument();
    expect(getForYouFeed).toHaveBeenLastCalledWith({ cursor: "next-token" });
  });
});
