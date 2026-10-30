import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Login from "./Login";
import useAuth from "../../hooks/useAuth";

vi.mock("../../hooks/useAuth", () => ({
  default: vi.fn(),
}));

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<h1>RiceHub home</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Login", () => {
  const login = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      login,
      verifyTwoFactor: vi.fn(),
    });
  });

  it("toggles password visibility", () => {
    renderLogin();

    const password = screen.getByPlaceholderText("Password");
    expect(password).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");

    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password).toHaveAttribute("type", "password");
  });

  it("shows the home page after a successful login", async () => {
    login.mockResolvedValue({ id: 1, username: "test-user" });
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText("Username"), {
      target: { value: "test-user" },
    });
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "correct-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByRole("heading", { name: "RiceHub home" })).toBeInTheDocument();
    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        username: "test-user",
        password: "correct-password",
      });
    });
  });
});
