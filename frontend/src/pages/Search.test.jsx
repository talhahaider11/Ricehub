import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useParams } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Search from "./Search";
import searchService from "../services/searchService";

vi.mock("../services/searchService", () => ({
  default: { global: vi.fn() },
}));

function ProfileRoute() {
  const { id } = useParams();
  const location = useLocation();
  return (
    <>
      <h1>Profile {id}</h1>
      <output data-testid="location">{location.pathname}{location.search}</output>
    </>
  );
}

describe("Search results", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchService.global.mockResolvedValue({
      users: [{ id: 25, username: "search-result" }],
      posts: [
        {
          id: 8,
          post_type: "reel",
          content: "A searched reel",
          author: { username: "reel-author" },
          media_assets: [],
        },
        {
          id: 9,
          post_type: "post",
          content: "A searched post",
          author: { username: "post-author" },
          media_assets: [],
        },
      ],
      groups: [{ id: 4, name: "Rice growers", description: "Local community" }],
      hashtags: [{ id: 3, name: "riceharvest", post_count: 7 }],
    });
  });

  it("opens a user's profile from account results", async () => {
    render(
      <MemoryRouter initialEntries={["/search?q=search-result"]}>
        <Routes>
          <Route path="/search" element={<Search />} />
          <Route path="/search/profile/:id" element={<ProfileRoute />} />
        </Routes>
      </MemoryRouter>
    );

    const result = await screen.findByRole("link", { name: /search-result/ }, { timeout: 10000 });
    expect(searchService.global).toHaveBeenCalledWith("search-result");
    fireEvent.click(result);

    expect(await screen.findByRole("heading", { name: "Profile 25" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/search/profile/25?q=search-result"
    );
  }, 10000);

  it("shows grouped content and filters results by reels", async () => {
    render(
      <MemoryRouter initialEntries={["/search?q=rice"]}>
        <Routes>
          <Route path="/search" element={<Search />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("A searched post")).toBeInTheDocument();
    expect(screen.getByText("Rice growers")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /#riceharvest/ })).toHaveAttribute(
      "href",
      "/hashtag/riceharvest"
    );

    fireEvent.click(screen.getByRole("button", { name: /Reels/ }));

    expect(screen.getByText("A searched reel")).toBeInTheDocument();
    expect(screen.queryByText("A searched post")).not.toBeInTheDocument();
  }, 10000);
});
