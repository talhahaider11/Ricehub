import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HelpSupport from "./HelpSupport";
import authService from "../services/authService";

vi.mock("../services/authService", () => ({
  default: {
    changePassword: vi.fn(),
    submitSupportRequest: vi.fn(),
  },
}));

describe("HelpSupport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters support articles by category and search", () => {
    render(
      <MemoryRouter>
        <HelpSupport />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Privacy" }));
    expect(screen.getByText("Who can see my profile and activity?")).toBeInTheDocument();
    expect(screen.queryByText("I forgot my password. How can I get back into my account?"))
      .not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search help articles"), {
      target: { value: "block" },
    });
    expect(screen.getByText("How do I block or unblock someone?")).toBeInTheDocument();
    expect(screen.queryByText("Who can see my profile and activity?")).not.toBeInTheDocument();
  });

  it("changes the signed-in user’s password after matching confirmation", async () => {
    authService.changePassword.mockResolvedValue({});
    render(
      <MemoryRouter>
        <HelpSupport />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "CurrentPassword123" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "NewSecurePassword123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "NewSecurePassword123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));

    expect(authService.changePassword).toHaveBeenCalledWith({
      current_password: "CurrentPassword123",
      new_password: "NewSecurePassword123",
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Password changed. Other active sessions have been signed out."
    );
  });

  it("does not submit a password when confirmation does not match", async () => {
    render(
      <MemoryRouter>
        <HelpSupport />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "CurrentPassword123" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "NewSecurePassword123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "DifferentPassword123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The new passwords don’t match.");
    expect(authService.changePassword).not.toHaveBeenCalled();
  });

  it("submits a support request with its subject and details", async () => {
    authService.submitSupportRequest.mockResolvedValue({
      detail: "Your support request was submitted.",
    });
    render(
      <MemoryRouter>
        <HelpSupport />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("Subject"), {
      target: { value: "Search is unavailable" },
    });
    fireEvent.change(screen.getByLabelText("What happened?"), {
      target: { value: "Search results did not load." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit issue" }));

    expect(authService.submitSupportRequest).toHaveBeenCalledWith({
      subject: "Search is unavailable",
      details: "Search results did not load.",
    });
    expect(await screen.findByText("Your support request was submitted.")).toBeInTheDocument();
  });
});
