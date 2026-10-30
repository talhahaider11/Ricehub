import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useContext } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import authService from "../services/authService";
import { AuthContext, AuthProvider } from "./AuthContext";

vi.mock("../services/authService", () => ({
  default: {
    getMe: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    verifyTwoFactor: vi.fn(),
    register: vi.fn(),
  },
}));

vi.mock("../services/pushNotificationService", () => ({
  initializePushNotifications: vi.fn(),
  unregisterPushDevice: vi.fn(),
}));

function AuthStateProbe() {
  const { user, login } = useContext(AuthContext);

  const attemptLogin = async () => {
    try {
      await login({ username: "unknown", password: "wrong" });
    } catch {
      // The test checks that a rejected login does not preserve the old user.
    }
  };

  return (
    <>
      <p>{user ? `Signed in as ${user.username}` : "Signed out"}</p>
      <button onClick={attemptLogin}>Try login</button>
    </>
  );
}

describe("AuthProvider login", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("ricemarket_access_token", "old-access-token");
    localStorage.setItem("ricemarket_refresh_token", "old-refresh-token");
    vi.clearAllMocks();
    authService.getMe.mockResolvedValue({ id: 1, username: "previous-user" });
    authService.logout.mockImplementation(() => {
      localStorage.removeItem("ricemarket_access_token");
      localStorage.removeItem("ricemarket_refresh_token");
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
    });
    authService.login.mockRejectedValue({
      response: { status: 401, data: { error: "Invalid credentials." } },
    });
  });

  it("clears an existing session before attempting new credentials", async () => {
    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    );

    expect(await screen.findByText("Signed in as previous-user")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try login" }));

    await waitFor(() => {
      expect(screen.getByText("Signed out")).toBeInTheDocument();
    });
    expect(authService.logout.mock.invocationCallOrder[0]).toBeLessThan(
      authService.login.mock.invocationCallOrder[0]
    );
    expect(localStorage.getItem("ricemarket_access_token")).toBeNull();
    expect(localStorage.getItem("ricemarket_refresh_token")).toBeNull();
  });
});
