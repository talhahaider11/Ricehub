import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Hashtag from "./Hashtag";
import searchService from "../services/searchService";
import useAuth from "../hooks/useAuth";

vi.mock("../services/searchService", () => ({
  default: { hashtag: vi.fn() },
}));

vi.mock("../hooks/useAuth", () => ({
  default: vi.fn(),
}));

vi.mock("../components/posts/PostCard", () => ({
  default: ({ post }) => <article>{post.content}</article>,
}));

describe("Hashtag page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: { id: 1 } });
    searchService.hashtag.mockResolvedValue({
      hashtag: "ricehub",
      posts: [{ id: 5, content: "Tagged post" }],
      next: null,
    });
  });

  it("loads the hashtag feed for the route tag", async () => {
    render(
      <MemoryRouter initialEntries={["/hashtag/ricehub"]}>
        <Routes>
          <Route path="/hashtag/:tag" element={<Hashtag />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "#ricehub" })).toBeInTheDocument();
    expect(screen.getByText("Tagged post")).toBeInTheDocument();
    expect(searchService.hashtag).toHaveBeenCalledWith("ricehub");
  });
});
