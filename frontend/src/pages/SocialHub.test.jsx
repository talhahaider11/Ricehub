import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import SocialHub from "./SocialHub";
import communityService from "../services/communityService";

vi.mock("../hooks/useAuth", () => ({
  default: () => ({ user: { id: 7 } }),
}));

vi.mock("../services/communityService", () => ({
  default: {
    stories: vi.fn(),
    communities: vi.fn(),
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
});
