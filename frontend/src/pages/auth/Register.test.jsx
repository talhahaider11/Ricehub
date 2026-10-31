import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Register from "./Register";
import useAuth from "../../hooks/useAuth";
import userService from "../../services/userService";

vi.mock("../../hooks/useAuth", () => ({
  default: vi.fn(),
}));

vi.mock("../../services/userService", () => ({
  default: {
    checkUsername: vi.fn(),
  },
}));

describe("Register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ register: vi.fn().mockResolvedValue({}) });
    userService.checkUsername.mockResolvedValue({
      available: false,
      suggestions: ["taken1", "taken2", "taken3"],
    });
  });

  it("checks usernames and lets the user choose an available suggestion", async () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    const username = screen.getByPlaceholderText("Username");
    fireEvent.change(username, { target: { value: "taken" } });

    expect(await screen.findByText("That username appears to be taken. Try one of these:")).toBeInTheDocument();
    expect(userService.checkUsername).toHaveBeenCalledWith("taken");

    fireEvent.click(screen.getByRole("button", { name: "taken2" }));
    expect(username).toHaveValue("taken2");
  });

  it("uses the browser password manager without showing a second password chooser", () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    const password = screen.getByPlaceholderText("Password");
    expect(password).toHaveValue("");
    expect(password).toHaveAttribute("autocomplete", "new-password");
    expect(screen.queryByRole("dialog", { name: "Choose a password" })).not.toBeInTheDocument();

    fireEvent.focus(password);
    expect(screen.getByPlaceholderText("Confirm password")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Choose a password" })).not.toBeInTheDocument();
  });

  it("shows username suggestions when signup detects a duplicate", async () => {
    const register = vi.fn().mockRejectedValue({
      response: {
        data: {
          error: "Username or email is already registered.",
        },
      },
    });
    useAuth.mockReturnValue({ register });
    userService.checkUsername
      .mockResolvedValueOnce({ available: true, suggestions: [] })
      .mockResolvedValueOnce({
      available: false,
      suggestions: ["taken1", "taken2", "taken3"],
      });

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText("Username"), {
      target: { value: "taken" },
    });
    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "person@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "StrongPassword123!" },
    });
    fireEvent.change(screen.getByPlaceholderText("Confirm password"), {
      target: { value: "StrongPassword123!" },
    });
    expect(await screen.findByText("Username is available.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Register" }));

    expect(await screen.findByRole("button", { name: "taken1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "taken2" })).toBeInTheDocument();
    expect(register).toHaveBeenCalled();
  });

  it("lets the server decide when the availability check says a username is taken", async () => {
    const register = vi.fn().mockResolvedValue({});
    useAuth.mockReturnValue({ register });
    userService.checkUsername.mockResolvedValue({
      available: false,
      suggestions: ["new-user1"],
    });

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByPlaceholderText("Username"), {
      target: { value: "new-user" },
    });
    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "StrongPassword123!" },
    });
    fireEvent.change(screen.getByPlaceholderText("Confirm password"), {
      target: { value: "StrongPassword123!" },
    });
    expect(await screen.findByText("That username appears to be taken. Try one of these:")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Register" }));
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "new-user",
        email: "new@example.com",
        password: "StrongPassword123!",
        password2: "StrongPassword123!",
      })
    );
  });
});
