import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import FriendsSuggestions from "./FriendsSuggestions";
import friendService from "../../services/friendService";
import searchService from "../../services/searchService";

vi.mock("../../services/friendService", () => ({
  default: { send: vi.fn() },
}));

vi.mock("../../services/searchService", () => ({
  default: { suggestions: vi.fn() },
}));

describe("Friend suggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchService.suggestions.mockResolvedValue({
      results: [{ id: 7, username: "mutual-friend" }],
    });
  });

  it("loads API suggestions and sends a request to the selected user", async () => {
    render(<FriendsSuggestions />);

    expect(await screen.findByText("mutual-friend")).toBeInTheDocument();
    friendService.send.mockResolvedValue({});
    fireEvent.click(screen.getByRole("button", { name: "Add friend" }));

    expect(searchService.suggestions).toHaveBeenCalledOnce();
    await waitFor(() => expect(friendService.send).toHaveBeenCalledWith(7));
  });
});
