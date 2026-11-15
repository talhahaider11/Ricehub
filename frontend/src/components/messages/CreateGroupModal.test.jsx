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
  useLanguage: () => ({ t: (key) => key }),
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
    expect(screen.getByRole("button", { name: "createGroup" })).toBeDisabled();
  });
});
