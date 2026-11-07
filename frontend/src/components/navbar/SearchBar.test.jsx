import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SearchBar from "./SearchBar";
import searchService from "../../services/searchService";

vi.mock("../../services/searchService", () => ({
  default: {
    global: vi.fn(),
  },
}));

function CurrentLocation() {
  const location = useLocation();
  return <output aria-label="Current location">{location.pathname}{location.search}</output>;
}

describe("SearchBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("searches for users and posts and opens post results", async () => {
    searchService.global.mockResolvedValue({
      users: [{ id: 8, username: "ricegrower" }],
      posts: [{ id: 14, content: "Wheat harvest update" }],
    });

    render(
      <MemoryRouter>
        <SearchBar />
        <CurrentLocation />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByRole("combobox", { name: /users and posts/i }), {
      target: { value: "  wheat " },
    });

    expect(screen.getByText("Searching...")).toBeInTheDocument();
    expect(await screen.findByText("ricegrower")).toBeInTheDocument();
    expect(await screen.findByText("Wheat harvest update")).toBeInTheDocument();
    expect(searchService.global).toHaveBeenCalledWith("wheat");

    fireEvent.click(screen.getByRole("option", { name: /wheat harvest update/i }));
    await waitFor(() => {
      expect(screen.getByLabelText("Current location")).toHaveTextContent(
        "/search?q=wheat&type=posts"
      );
    });
  });
});
