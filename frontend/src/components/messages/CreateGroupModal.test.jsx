import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CreateGroupModal from "./CreateGroupModal";

vi.mock("../common/Modal", () => ({
  default: ({ children }) => <div>{children}</div>,
}));

vi.mock("../../hooks/useAuth", () => ({
  default: () => ({ user: { id: 1, is_verified: false } }),
}));

vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key) => ({
      groupName: "Group name",
      userIdOrName: "Search user by ID or username",
      userIdOrNamePlaceholder: "Enter user ID or username...",
      findUser: "Find user",
      createGroup: "Create group",
    })[key] || key,
  }),
}));

vi.mock("../../services/messageService", () => ({
  default: {
    searchGroupMembers: vi.fn(),
    createGroup: vi.fn(),
  },
}));

describe("CreateGroupModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks group creation for an unverified creator with a clear message", () => {
    render(
      <CreateGroupModal
        open
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Only verified users can create group conversations."
    );
    expect(screen.getByRole("button", { name: "Create group" })).toBeDisabled();
    expect(screen.getByLabelText("Group name")).toBeInTheDocument();
    expect(screen.getByLabelText("Search user by ID or username")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter user ID or username..."))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Find user" })).toBeInTheDocument();
  });
});
