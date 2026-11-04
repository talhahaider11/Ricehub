import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DeleteAccount from "./DeleteAccount";
import PrivacyPolicy from "./PrivacyPolicy";
import TermsOfService from "./TermsOfService";
import settingsService from "../services/settingsService";
import useAuth from "../hooks/useAuth";

vi.mock("../hooks/useAuth", () => ({
  default: vi.fn(),
}));

vi.mock("../services/settingsService", () => ({
  default: {
    deleteAccount: vi.fn(),
  },
}));

function renderPage(page) {
  return render(<MemoryRouter>{page}</MemoryRouter>);
}

describe("public legal and account pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("explains the product's data use and deletion choices in the privacy policy", () => {
    renderPage(<PrivacyPolicy />);

    expect(screen.getByRole("heading", { name: "Privacy Policy" })).toBeInTheDocument();
    expect(screen.getByText(/security-event records are configured for deletion after 90 days/i))
      .toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Delete Account" })).toHaveAttribute(
      "href",
      "/delete-account"
    );
  });

  it("publishes terms with a link to account deletion", () => {
    renderPage(<TermsOfService />);

    expect(screen.getByRole("heading", { name: "Terms of Service" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Delete Account" })).toHaveAttribute(
      "href",
      "/delete-account"
    );
  });

  it("provides a public sign-in path when the visitor is logged out", () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      loading: false,
      logout: vi.fn(),
    });
    renderPage(<DeleteAccount />);

    expect(screen.getByRole("heading", { name: "Delete your RiceHub account" }))
      .toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in to continue" }))
      .toHaveAttribute("href", "/login");
  });

  it("deletes the authenticated account after password and DELETE confirmation", async () => {
    const logout = vi.fn();
    useAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      logout,
    });
    settingsService.deleteAccount.mockResolvedValue({ message: "Account deleted." });
    renderPage(<DeleteAccount />);

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "CurrentPassword123" },
    });
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), {
      target: { value: "DELETE" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Permanently delete account" }));

    await waitFor(() => {
      expect(settingsService.deleteAccount).toHaveBeenCalledWith({
        password: "CurrentPassword123",
        confirmation: "DELETE",
      });
    });
    expect(logout).toHaveBeenCalledOnce();
  });
});
