import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GroupMemberModal from "./GroupMemberModal";
import messageService from "../../services/messageService";

vi.mock("../../services/messageService", () => ({
  default: {
    addGroupMember: vi.fn(),
    updateGroupMember: vi.fn(),
    removeGroupMember: vi.fn(),
    updateGroupSettings: vi.fn(),
    muteConversation: vi.fn(),
    leaveGroup: vi.fn(),
    searchGroupMembers: vi.fn(),
  },
}));

const group = {
  id: 5,
  name: "Rice group",
  member_count: 2,
  is_muted: false,
  admins_only: false,
  memberships: [
    { user: { id: 7, username: "owner" }, role: "admin" },
    { user: { id: 9, username: "member" }, role: "member" },
  ],
};

describe("GroupMemberModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows member count and lets an admin promote members and restrict posting", async () => {
    const onUpdated = vi.fn();
    messageService.updateGroupMember.mockResolvedValue(group);
    messageService.updateGroupSettings.mockResolvedValue(group);

    render(
      <GroupMemberModal
        open
        onClose={vi.fn()}
        conversation={group}
        currentUser={{ id: 7 }}
        onUpdated={onUpdated}
        onLeave={vi.fn()}
      />
    );

    expect(screen.getByText("2 members")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Make admin" }));
    await waitFor(() => expect(messageService.updateGroupMember)
      .toHaveBeenCalledWith(5, 9, "admin"));

    fireEvent.click(screen.getByRole("checkbox", {
      name: /Only admins can send messages/,
    }));
    await waitFor(() => expect(messageService.updateGroupSettings)
      .toHaveBeenCalledWith(5, true));
    expect(onUpdated).toHaveBeenCalled();
  });

  it("does not show admin controls to a regular group member", () => {
    render(
      <GroupMemberModal
        open
        onClose={vi.fn()}
        conversation={group}
        currentUser={{ id: 9 }}
        onUpdated={vi.fn()}
        onLeave={vi.fn()}
      />
    );

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Make admin" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mute" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave group" })).toBeInTheDocument();
  });
});
