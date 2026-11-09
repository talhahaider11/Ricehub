import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useContext } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import authService from "../services/authService";
import {
  initializePushNotifications,
  registerPushListeners,
} from "../services/pushNotificationService";
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
  registerPushListeners: vi.fn(),
  unregisterPushDevice: vi.fn(),
}));

function AuthStateProbe() {
  const { user, login } = useContext(AuthContext);

  const attemptLogin = async (credentials) => {
    try {
      await login(credentials);
    } catch {
      // The test checks the final authentication state after login.
    }
  };

  return (
    <>
      <p>{user ? `Signed in as ${user.username}` : "Signed out"}</p>
      <button
        onClick={() =>
          attemptLogin({ username: "unknown", password: "wrong" })
        }
      >
        Try login
      </button>
      <button
        onClick={() =>
          attemptLogin({ username: "new-user", password: "correct" })
        }
      >
        Login successfully
      </button>
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

  it("initializes push listeners when restoring an authenticated session", async () => {
    authService.getMe.mockResolvedValue({ id: 2, username: "new-user" });
    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    );

    await screen.findByText("Signed in as new-user");
    await waitFor(() => {
      expect(registerPushListeners).toHaveBeenCalledOnce();
      expect(initializePushNotifications).toHaveBeenCalledOnce();
    });
  });

  it("initializes push listeners after a successful login", async () => {
    authService.login.mockResolvedValue({ access: "access", refresh: "refresh" });
    authService.getMe
      .mockResolvedValueOnce({ id: 1, username: "previous-user" })
      .mockResolvedValueOnce({ id: 2, username: "new-user" });
    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    );

    await screen.findByText("Signed in as previous-user");
    await waitFor(() => {
      expect(registerPushListeners).toHaveBeenCalledOnce();
    });

    fireEvent.click(screen.getByRole("button", { name: "Login successfully" }));

    await screen.findByText("Signed in as new-user");
    await waitFor(() => {
      expect(registerPushListeners).toHaveBeenCalledTimes(2);
      expect(initializePushNotifications).toHaveBeenCalledTimes(2);
    });
  });

  it("keeps the saved login when the profile temporarily cannot be loaded", async () => {
    authService.login.mockImplementation(async () => {
      localStorage.setItem("ricemarket_access_token", "new-access");
      localStorage.setItem("ricemarket_refresh_token", "new-refresh");
      return { access: "new-access", refresh: "new-refresh" };
    });
    authService.getMe
      .mockResolvedValueOnce({ id: 1, username: "previous-user" })
      .mockRejectedValueOnce(new Error("Profile request failed"));
    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    );

    await screen.findByText("Signed in as previous-user");
    fireEvent.click(screen.getByRole("button", { name: "Login successfully" }));

    await waitFor(() => {
      expect(authService.logout).toHaveBeenCalledOnce();
      expect(screen.getByText("Signed out")).toBeInTheDocument();
    });
    expect(localStorage.getItem("ricemarket_access_token")).toBe("new-access");
    expect(localStorage.getItem("ricemarket_refresh_token")).toBe("new-refresh");
  });

  it("restores the saved login after a temporary network failure", async () => {
    authService.getMe
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce({ id: 2, username: "restored-user" });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    );

    await screen.findByText("Signed out");
    expect(authService.logout).not.toHaveBeenCalled();
    expect(localStorage.getItem("ricemarket_refresh_token")).toBe("old-refresh-token");

    window.dispatchEvent(new Event("online"));

    expect(await screen.findByText("Signed in as restored-user")).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
