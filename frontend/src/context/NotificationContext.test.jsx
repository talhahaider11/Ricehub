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

function NotificationError() {
  const { error } = useContext(NotificationContext);
  return error ? <span role="alert">{error}</span> : null;
}

describe("NotificationProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: { id: 1 } });
  });

  it("counts unread notifications from the paginated API response", async () => {
    notificationService.list.mockResolvedValue({
      results: [{ is_read: false }, { is_read: true }],
      unread_count: 17,
    });

    render(
      <NotificationProvider>
        <NotificationCount />
      </NotificationProvider>
    );

    expect(await screen.findByText("Unread: 17")).toBeInTheDocument();
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
        expect.any(Error)
      );
    });
    consoleError.mockRestore();
  });

  it("shows the backend's notification error to the user", async () => {
    notificationService.list.mockRejectedValue({
      response: {
        status: 503,
        data: { detail: "Notification service is unavailable." },
      },
    });

    render(
      <NotificationProvider>
        <NotificationError />
      </NotificationProvider>
    );

    expect(
      await screen.findByText("Notification service is unavailable.")
    ).toHaveAttribute("role", "alert");
  });
});
