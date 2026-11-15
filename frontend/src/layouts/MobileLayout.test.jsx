import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MobileLayout from "./MobileLayout";

vi.mock("../hooks/useAuth", () => ({
  default: () => ({ user: { id: 7 } }),
}));

vi.mock("../context/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key) => key,
  }),
}));

describe("MobileLayout", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("navigates to and highlights the current user's profile", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <MobileLayout />
      </MemoryRouter>
    );

    const profileLink = screen.getByRole("link", { name: "Profile" });
    expect(profileLink).toHaveAttribute("href", "/profile/7");
    fireEvent.click(profileLink);

    expect(profileLink).toHaveAttribute("aria-current", "page");
    expect(profileLink).toHaveClass("active");
  });
});
