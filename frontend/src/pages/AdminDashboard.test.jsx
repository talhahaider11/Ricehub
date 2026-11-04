import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminDashboard from "./AdminDashboard";
import moderationService from "../services/moderationService";

vi.mock("../services/moderationService", () => ({
  default: {
    getAdminOverview: vi.fn(),
    getContentReports: vi.fn(),
    getAccountReports: vi.fn(),
    getAdminUsers: vi.fn(),
    getUserAnalytics: vi.fn(),
    updateContentReport: vi.fn(),
    updateAccountReport: vi.fn(),
    suspendUser: vi.fn(),
    unsuspendUser: vi.fn(),
    deleteUser: vi.fn(),
  },
}));

describe("AdminDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    moderationService.getAdminOverview.mockResolvedValue({
      users: 12,
      active_users: 10,
      users_today: 2,
      posts: 30,
      comments: 44,
      messages: 51,
      open_content_reports: 1,
      open_account_reports: 0,
    });
    moderationService.getContentReports.mockResolvedValue({
      results: [
        {
          id: 8,
          target_type: "post",
          target_id: 23,
          reason: "spam",
          reporter_username: "reporter",
          target_author_username: "author",
          target_text: "Reported post",
          details: "",
        },
      ],
    });
    moderationService.getAccountReports.mockResolvedValue({ results: [] });
    moderationService.getAdminUsers.mockResolvedValue({ results: [] });
    moderationService.getUserAnalytics.mockResolvedValue({
      days: 30,
      daily_signups: [],
      suspended_users: 0,
    });
    moderationService.updateContentReport.mockResolvedValue({});
  });

  it("shows operational stats and lets staff triage a content report", async () => {
    render(<AdminDashboard />);

    expect(
      await screen.findByRole("heading", { name: "Moderation dashboard" })
    ).toBeInTheDocument();
    expect(screen.getByText("Reported post")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    await waitFor(() => {
      expect(moderationService.updateContentReport).toHaveBeenCalledWith(8, {
        status: "dismissed",
        resolution_note: "",
      });
    });
  });

  it("reviews account reports and lets staff suspend an account with a reason", async () => {
    moderationService.getAccountReports.mockResolvedValue({
      results: [
        {
          id: 12,
          reported_username: "reported-user",
          reporter_username: "reporter",
          reason: "harassment",
          details: "Repeated abuse",
        },
      ],
    });
    moderationService.getAdminUsers.mockResolvedValue({
      results: [
        {
          id: 7,
          username: "reported-user",
          email: "reported@example.com",
          is_active: true,
          is_suspended: false,
          is_superuser: false,
        },
      ],
    });
    moderationService.getUserAnalytics.mockResolvedValue({
      days: 30,
      daily_signups: [],
      suspended_users: 0,
    });

    render(<AdminDashboard />);

    expect(await screen.findByText("@reported-user · harassment")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Mark reviewed" })[1]);
    await waitFor(() => {
      expect(moderationService.updateAccountReport).toHaveBeenCalledWith(12, {
        status: "reviewed",
        moderator_notes: "",
      });
    });

    fireEvent.change(await screen.findByLabelText("Suspension reason"), {
      target: { value: "Repeated abusive content" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Suspend" }));
    await waitFor(() => {
      expect(moderationService.suspendUser).toHaveBeenCalledWith(
        7,
        "Repeated abusive content"
      );
    });
  });

  it("requires confirmation before deleting a user and records the action", async () => {
    moderationService.getAdminUsers.mockResolvedValue({
      results: [
        {
          id: 7,
          username: "reported-user",
          email: "reported@example.com",
          is_active: true,
          is_suspended: false,
          is_superuser: false,
        },
      ],
    });
    moderationService.deleteUser.mockResolvedValue({});
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<AdminDashboard />);
    fireEvent.click(await screen.findByRole("button", { name: "Delete account" }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith(
        "Permanently delete @reported-user?"
      );
      expect(moderationService.deleteUser).toHaveBeenCalledWith(
        7,
        "Deleted by a staff member from the administration dashboard."
      );
    });
    confirmSpy.mockRestore();
  });

  it("applies status, staff, and suspension filters to the user list", async () => {
    render(<AdminDashboard />);

    await screen.findByRole("heading", { name: "User management" });
    fireEvent.change(screen.getByLabelText("Account status"), {
      target: { value: "suspended" },
    });
    fireEvent.change(screen.getByLabelText("Staff accounts"), {
      target: { value: "true" },
    });
    fireEvent.change(screen.getByLabelText("Suspension filter"), {
      target: { value: "true" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(moderationService.getAdminUsers).toHaveBeenLastCalledWith({
        status: "suspended",
        q: "",
        staff: "true",
        suspended: "true",
      });
    });
  });
});
