import { render, screen, waitFor } from "@testing-library/react";
import { useContext } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import notificationService from "../services/notificationService";
import useAuth from "../hooks/useAuth";
import {
  NotificationContext,
  NotificationProvider,
} from "./NotificationContext";

vi.mock("../services/notificationService", () => ({
  default: {
    list: vi.fn(),
  },
}));

vi.mock("../hooks/useAuth", () => ({
  default: vi.fn(),
}));

function NotificationCount() {
  const { unreadCount } = useContext(NotificationContext);
  return <span>Unread: {unreadCount}</span>;
}

describe("NotificationProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: { id: 1 } });
  });

  it("counts unread notifications from the paginated API response", async () => {
    notificationService.list.mockResolvedValue({
      results: [{ is_read: false }, { is_read: true }],
    });

    render(
      <NotificationProvider>
        <NotificationCount />
      </NotificationProvider>
    );

    expect(await screen.findByText("Unread: 1")).toBeInTheDocument();
  });

  it("keeps the app rendered when the API returns a non-list response", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    notificationService.list.mockResolvedValue({ detail: "Service unavailable" });

    render(
      <NotificationProvider>
        <NotificationCount />
      </NotificationProvider>
    );

    expect(await screen.findByText("Unread: 0")).toBeInTheDocument();
    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        "Notifications could not be loaded:",
        expect.any(TypeError)
      );
    });
    consoleError.mockRestore();
  });
});
