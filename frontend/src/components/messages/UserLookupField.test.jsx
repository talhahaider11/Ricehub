import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import messageService from "../../services/messageService";
import UserLookupField from "./UserLookupField";

vi.mock("../../services/messageService", () => ({
  default: {
    searchGroupMembers: vi.fn(),
  },
}));

vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key) => ({
      userIdOrName: "Search user by ID or username",
      userIdOrNamePlaceholder: "Enter user ID or username...",
      findUser: "Find user",
    })[key] || key,
  }),
}));

describe("UserLookupField", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows verified ID/name matches and selects the chosen user", async () => {
    messageService.searchGroupMembers.mockResolvedValue({
      results: [
        {
          id: 24,
          username: "jasmine",
          first_name: "Jasmine",
          last_name: "Rice",
          is_verified: true,
        },
      ],
    });
    const onSelect = vi.fn();

    render(<UserLookupField onSelect={onSelect} />);
    expect(screen.getByPlaceholderText("Enter user ID or username..."))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Find user" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search user by ID or username"), {
      target: { value: "Jasmine" },
    });

    const match = await screen.findByRole("option");
    expect(match).toHaveTextContent("Jasmine Rice");
    expect(match).toHaveTextContent("@jasmine · ID 24");
    expect(screen.getByLabelText("Verified account")).toBeInTheDocument();

    fireEvent.click(match);
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(24));
  });

  it("does not show unverified search matches", async () => {
    messageService.searchGroupMembers.mockResolvedValue({
      results: [
        { id: 25, username: "not-verified", is_verified: false },
      ],
    });

    render(<UserLookupField onSelect={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Search user by ID or username"), {
      target: { value: "not-verified" },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("groupUserNotFound");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });
});
