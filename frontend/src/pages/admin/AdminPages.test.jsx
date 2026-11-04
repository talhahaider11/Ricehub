import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminUsers from "./AdminUsers";
import AdminUserDetails from "./AdminUserDetails";
import AdminReportDetails from "./AdminReportDetails";
import AdminPosts from "./AdminPosts";
import adminService from "../../services/adminService";
import useAuth from "../../hooks/useAuth";

vi.mock("../../services/adminService", () => ({
  default: {
    getUsers: vi.fn(),
    getUser: vi.fn(),
    suspendUser: vi.fn(),
    unsuspendUser: vi.fn(),
    getReport: vi.fn(),
    updateReport: vi.fn(),
    getPosts: vi.fn(),
    deletePost: vi.fn(),
  },
}));

vi.mock("../../hooks/useAuth", () => ({
  default: vi.fn(),
}));

describe("modular admin pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: { id: 1, is_staff: true } });
    adminService.getUsers.mockResolvedValue({
      results: [{
        id: 4,
        username: "member",
        email: "member@example.test",
        is_active: true,
        is_suspended: false,
        created_at: "2026-01-01T00:00:00Z",
      }],
    });
    adminService.getUser.mockResolvedValue({
      id: 4,
      username: "member",
      email: "member@example.test",
      is_active: true,
      is_suspended: false,
      is_superuser: false,
      date_joined: "2026-01-01T00:00:00Z",
      post_count: 2,
      friend_count: 3,
    });
    adminService.getReport.mockResolvedValue({
      id: 9,
      reporter_username: "reporter",
      target_type: "post",
      target_id: 8,
      target_author_username: "author",
      reason: "spam",
      details: "Spam report",
      target_text: "Unwanted content",
      status: "open",
      created_at: "2026-01-01T00:00:00Z",
      resolution_note: "",
    });
    adminService.getPosts.mockResolvedValue({
      results: [{ id: 8, content: "Policy violating content", author: { username: "author" }, created_at: "2026-01-01T00:00:00Z" }],
    });
  });

  it("searches users and opens the user detail route", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/users"]}>
        <Routes>
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/users/:id" element={<AdminUserDetails />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("@member")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "View" }));
    expect(await screen.findByText("member@example.test")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("updates a report decision with moderator notes", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/reports/9"]}>
        <Routes>
          <Route path="/admin/reports/:id" element={<AdminReportDetails />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Report #9" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "dismissed" },
    });
    fireEvent.change(screen.getByLabelText("Moderator notes"), {
      target: { value: "Reviewed and dismissed." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save review" }));

    await waitFor(() => {
      expect(adminService.updateReport).toHaveBeenCalledWith("9", {
        status: "dismissed",
        resolution_note: "Reviewed and dismissed.",
      });
    });
  });

  it("requires an audit reason before deleting a post", async () => {
    render(
      <MemoryRouter>
        <AdminPosts />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Delete post" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Delete post" })[1]);
    expect(adminService.deletePost).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Audit reason"), {
      target: { value: "Policy violation" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Delete post" })[1]);
    await waitFor(() => {
      expect(adminService.deletePost).toHaveBeenCalledWith(8, "Policy violation");
    });
  });
});
