import { fireEvent, render, screen } from "@testing-library/react";
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
    useAuth.mockReturnValue({ register: vi.fn() });
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

  it("offers a strong password suggestion without forcing the user to use it", () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    const password = screen.getByPlaceholderText("Password");
    const confirmation = screen.getByPlaceholderText("Confirm password");
    expect(password).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: "Use a strong password suggestion" }));

    expect(password.value).toMatch(/^[A-Za-z0-9!@#$%^&*()\-_=+]{18}$/);
    expect(confirmation).toHaveValue(password.value);
    expect(password.value).toMatch(/[A-Z]/);
    expect(password.value).toMatch(/[a-z]/);
    expect(password.value).toMatch(/[0-9]/);
    expect(password.value).toMatch(/[!@#$%^&*()\-_=+]/);
  });
});
