import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Settings from "./Settings";
import { LanguageProvider } from "../context/LanguageContext";
import { ThemeProvider } from "../context/ThemeContext";
import notificationService from "../services/notificationService";
import settingsService from "../services/settingsService";
import userService from "../services/userService";

const authMock = vi.hoisted(() => ({
  user: {
    id: 1,
    username: "test-user",
    email: "test@example.com",
    is_email_verified: true,
    is_verified: true,
    is_subscription_verified: true,
    profile_visibility: "public",
  },
  setUser: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("../hooks/useAuth", () => ({
  default: () => authMock,
}));

vi.mock("../services/notificationService", () => ({
  default: {
    getPreferences: vi.fn(),
    updatePreferences: vi.fn(),
  },
}));

vi.mock("../services/settingsService", () => ({
  default: {
    getPrivacy: vi.fn(),
    getBlockedUsers: vi.fn(),
    getSecurity: vi.fn(),
  },
}));

vi.mock("../services/userService", () => ({
  default: {
    getMe: vi.fn(),
    updateMe: vi.fn(),
  },
}));

describe("Settings Urdu localization", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("ricehub-language", "ur");
    userService.getMe.mockClear();
    authMock.user = {
      id: 1,
      username: "test-user",
      email: "test@example.com",
      is_email_verified: true,
      is_verified: true,
      is_subscription_verified: true,
      profile_visibility: "public",
    };
    authMock.setUser.mockClear();
    userService.getMe.mockResolvedValue(authMock.user);
    notificationService.getPreferences.mockResolvedValue({
      friend_requests: true,
      friend_accepted: true,
      comments: true,
      reactions: true,
      messages: true,
      event_invitations: true,
      all_notifications: true,
    });
    settingsService.getPrivacy.mockResolvedValue({
      friend_requests_from: "everyone",
      messages_from: "everyone",
      discoverable_by_email: true,
      show_activity_status: true,
      show_last_seen: true,
      read_receipts: true,
    });
    settingsService.getBlockedUsers.mockResolvedValue([]);
    settingsService.getSecurity.mockResolvedValue({ two_factor_enabled: false });
  });

  it("translates settings headings and privacy options when Urdu is selected", async () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <LanguageProvider>
            <Settings />
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "ترتیبات اور رازداری" }))
      .toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "زبان" })).toBeInTheDocument();
    expect(screen.getByText("آپ کی پروفائل کون دیکھ سکتا ہے؟")).toBeInTheDocument();
    await waitFor(() => expect(settingsService.getPrivacy).toHaveBeenCalled());
  });

  it("persists the system notification toggle immediately", async () => {
    notificationService.updatePreferences.mockResolvedValue({
      all_notifications: false,
    });

    render(
      <MemoryRouter>
        <ThemeProvider>
          <LanguageProvider>
            <Settings />
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>
    );

    const toggle = await screen.findByRole("checkbox", {
      name: "سسٹم اور کال کی اطلاعات",
    });
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(notificationService.updatePreferences).toHaveBeenCalledWith({
        all_notifications: false,
      });
    });
    expect(localStorage.getItem("ricehub_notifications_enabled")).toBe("false");
  });

  it("refreshes the current user's verification status when settings opens", async () => {
    const refreshedUser = { ...authMock.user, is_subscription_verified: false };
    userService.getMe.mockResolvedValue(refreshedUser);

    render(
      <MemoryRouter>
        <ThemeProvider>
          <LanguageProvider>
            <Settings />
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(userService.getMe).toHaveBeenCalledTimes(1);
      expect(authMock.setUser).toHaveBeenCalledWith(refreshedUser);
    });
  });

  it("uses the active subscription field instead of a stale verified flag", async () => {
    localStorage.setItem("ricehub-language", "en");
    authMock.user = {
      ...authMock.user,
      is_verified: true,
      is_subscription_verified: false,
    };
    userService.getMe.mockResolvedValue(authMock.user);

    render(
      <MemoryRouter>
        <ThemeProvider>
          <LanguageProvider>
            <Settings />
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText("Unverified account · up to 3 posts"))
      .toBeInTheDocument();
    expect(screen.getByText("Not verified")).toBeInTheDocument();
  });
});
