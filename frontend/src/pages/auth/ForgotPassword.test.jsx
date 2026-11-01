import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ForgotPassword from "./ForgotPassword";
import authService from "../../services/authService";

vi.mock("../../services/authService", () => ({
  default: {
    requestPasswordReset: vi.fn(),
    confirmPasswordReset: vi.fn(),
  },
}));

describe("ForgotPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits a reset request and uses the same confirmation message", async () => {
    authService.requestPasswordReset.mockResolvedValue({});
    render(
      <MemoryRouter initialEntries={["/forgot-password"]}>
        <ForgotPassword />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "person@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "If an account exists for that email, password reset instructions will be sent."
    );
    expect(authService.requestPasswordReset).toHaveBeenCalledWith("person@example.com");
  });

  it("confirms a reset from the emailed query parameters and returns to login", async () => {
    authService.confirmPasswordReset.mockResolvedValue({});
    render(
      <MemoryRouter initialEntries={["/forgot-password?uid=encoded-id&token=secure-token"]}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/login" element={<p>Welcome to login</p>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "NewSecurePassword123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "NewSecurePassword123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(authService.confirmPasswordReset).toHaveBeenCalledWith({
      uid: "encoded-id",
      token: "secure-token",
      password: "NewSecurePassword123",
    });
    expect(await screen.findByText("Welcome to login")).toBeInTheDocument();
  });

  it("rejects mismatched passwords without sending them to the server", async () => {
    render(
      <MemoryRouter initialEntries={["/forgot-password?uid=id&token=token"]}>
        <ForgotPassword />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "NewSecurePassword123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "DifferentPassword123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The passwords don’t match.");
    expect(authService.confirmPasswordReset).not.toHaveBeenCalled();
  });
});
