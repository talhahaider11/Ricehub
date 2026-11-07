import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useParams } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Search from "./Search";
import userService from "../services/userService";
import useAuth from "../hooks/useAuth";
import searchService from "../services/searchService";

vi.mock("../services/userService", () => ({
  default: { search: vi.fn() },
}));

vi.mock("../services/searchService", () => ({
  default: { posts: vi.fn() },
}));

vi.mock("../hooks/useAuth", () => ({
  default: vi.fn(),
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

describe("Search profile navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: { id: 1 } });
    userService.search.mockResolvedValue({
      results: [{ id: 25, username: "search-result" }],
    });
    searchService.posts.mockResolvedValue({ results: [] });
  });

  it("opens a user's profile from people results", async () => {
    render(
      <MemoryRouter initialEntries={["/search?q=search-result"]}>
        <Routes>
          <Route path="/search" element={<Search />} />
          <Route path="/search/profile/:id" element={<ProfileRoute />} />
        </Routes>
      </MemoryRouter>
    );

    const result = await screen.findByRole("link", { name: /search-result/ }, { timeout: 10000 });
    expect(userService.search).toHaveBeenCalledWith("search-result");
    fireEvent.click(result);

    expect(await screen.findByRole("heading", { name: "Profile 25" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/search/profile/25?q=search-result"
    );
  }, 10000);
});
