import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Settings from "./Settings";
import { LanguageProvider } from "../context/LanguageContext";
import { ThemeProvider } from "../context/ThemeContext";
import notificationService from "../services/notificationService";
import settingsService from "../services/settingsService";

vi.mock("../hooks/useAuth", () => ({
  default: () => ({
    user: {
      id: 1,
      username: "test-user",
      email: "test@example.com",
      is_email_verified: true,
      is_verified: true,
      profile_visibility: "public",
    },
    setUser: vi.fn(),
    logout: vi.fn(),
  }),
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

describe("Settings Urdu localization", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("ricehub-language", "ur");
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
});
