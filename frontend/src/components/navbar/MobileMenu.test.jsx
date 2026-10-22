import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../../context/ThemeContext";
import MobileMenu from "./MobileMenu";

vi.mock("../../hooks/useAuth", () => ({
  default: () => ({
    user: { id: 7, username: "talha", first_name: "Talha", last_name: "Haider" },
    logout: vi.fn(),
  }),
}));

function renderMenu(onClose = vi.fn()) {
  return {
    onClose,
    ...render(
      <MemoryRouter>
        <ThemeProvider>
          <MobileMenu onClose={onClose} />
        </ThemeProvider>
      </MemoryRouter>
    ),
  };
}

describe("MobileMenu", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows the account and does not close on its initial render", () => {
    const { onClose } = renderMenu();

    expect(screen.getByRole("dialog", { name: "RiceHub menu" })).toBeInTheDocument();
    expect(screen.getByText("Talha Haider")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("expands the extra navigation and settings sections", () => {
    renderMenu();

    fireEvent.click(screen.getByRole("button", { name: /see more/i }));
    expect(screen.getByRole("link", { name: /friend requests/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /settings and privacy/i }));
    expect(screen.getByRole("link", { name: /privacy and audience/i })).toHaveAttribute(
      "href",
      "/settings#privacy"
    );
  });
});
