import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
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

function LocationDisplay() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.hash}</output>;
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

  it("renders outside the sticky header so the full drawer is not clipped", () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <header className="navbar">
            <MobileMenu onClose={vi.fn()} />
          </header>
        </ThemeProvider>
      </MemoryRouter>
    );

    const drawer = screen.getByRole("dialog", { name: "RiceHub menu" });
    expect(drawer.parentElement).toBe(document.body);
  });

  it("expands the extra navigation while keeping Settings as a single direct link", () => {
    renderMenu();

    fireEvent.click(screen.getByRole("button", { name: /see more/i }));
    expect(screen.getByRole("link", { name: /friend requests/i })).toBeInTheDocument();

    const settingsLink = screen.getByRole("link", { name: /^settings$/i });
    expect(settingsLink).toHaveAttribute("href", "/settings");
    expect(settingsLink.querySelectorAll("svg")).toHaveLength(1);
    expect(screen.queryByText("Privacy and audience")).not.toBeInTheDocument();
    expect(screen.queryByText("Security and login")).not.toBeInTheDocument();
    expect(screen.queryByText(/Appearance/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^settings$/i })).not.toBeInTheDocument();
  });

  it("closes the drawer and navigates to the categorized Settings page", () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <ThemeProvider>
          <MobileMenu onClose={onClose} />
          <LocationDisplay />
        </ThemeProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("link", { name: /^settings$/i }));

    expect(screen.getByTestId("location")).toHaveTextContent("/settings");
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps search and help support out of the expandable drawer", () => {
    renderMenu();

    expect(screen.queryByRole("link", { name: /search/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /see more/i }));
    expect(screen.queryByRole("link", { name: /help and support/i })).not.toBeInTheDocument();
  });
});
