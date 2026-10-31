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

    expect(await screen.findByText("That username is already taken. Try one of these:")).toBeInTheDocument();
    expect(userService.checkUsername).toHaveBeenCalledWith("taken");

    fireEvent.click(screen.getByRole("button", { name: "taken2" }));
    expect(username).toHaveValue("taken2");
  });

  it("shows a password chooser on focus and lets the user choose either option", () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    const password = screen.getByPlaceholderText("Password");
    expect(password).toHaveValue("");
    expect(screen.queryByRole("dialog", { name: "Choose a password" })).not.toBeInTheDocument();

    fireEvent.focus(password);
    expect(screen.getByRole("dialog", { name: "Choose a password" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create my own" }));
    expect(password).toHaveValue("");
    expect(password).toHaveAttribute("type", "password");
    expect(screen.getByPlaceholderText("Confirm password")).toBeInTheDocument();

    fireEvent.focus(password);
    fireEvent.click(screen.getByRole("button", { name: "Use suggested password" }));
    expect(password).toHaveAttribute("type", "text");
    expect(password.value).toMatch(/^[A-Za-z0-9!@#$%^&*()\-_=+]{18}$/);
    expect(screen.queryByPlaceholderText("Confirm password")).not.toBeInTheDocument();
  });

  it("shows username suggestions when signup detects a duplicate", async () => {
    const register = vi.fn().mockRejectedValue({
      response: {
        data: {
          username: ["This username is already taken."],
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
    expect(await screen.findByText("Username is available.")).toBeInTheDocument();
    fireEvent.focus(screen.getByPlaceholderText("Password"));
    fireEvent.click(screen.getByRole("button", { name: "Use suggested password" }));
    fireEvent.click(screen.getByRole("button", { name: "Register" }));

    expect(await screen.findByRole("button", { name: "taken1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "taken2" })).toBeInTheDocument();
    expect(register).toHaveBeenCalled();
  });

  it("submits the prefilled suggested password", async () => {
    const register = vi.fn().mockResolvedValue({});
    useAuth.mockReturnValue({ register });
    userService.checkUsername.mockResolvedValue({
      available: true,
      suggestions: [],
    });

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );
    const password = screen.getByPlaceholderText("Password");
    fireEvent.focus(password);
    fireEvent.click(screen.getByRole("button", { name: "Use suggested password" }));
    const suggestedPassword = password.value;
    expect(suggestedPassword).toMatch(/^[A-Za-z0-9!@#$%^&*()\-_=+]{18}$/);

    fireEvent.change(screen.getByPlaceholderText("Username"), {
      target: { value: "new-user" },
    });
    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "new@example.com" },
    });
    expect(await screen.findByText("Username is available.")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Register" }));
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({ password: suggestedPassword, password2: suggestedPassword })
    );
  });
});
