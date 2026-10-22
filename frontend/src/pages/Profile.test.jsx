import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Profile from "./Profile";
import userService from "../services/userService";

vi.mock("../services/userService", () => ({
  default: {
    getUser: vi.fn(),
  },
}));

vi.mock("../services/friendService", () => ({
  default: {
    send: vi.fn(),
  },
}));

vi.mock("../services/messageService", () => ({
  default: {
    createConversation: vi.fn(),
  },
}));

vi.mock("../hooks/useAuth", () => ({
  default: () => ({ user: { id: 12, username: "signed-in-user" } }),
}));

function renderProfile(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/profile/:id" element={<Profile />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Profile route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the selected friend's profile from a direct profile URL", async () => {
    userService.getUser.mockResolvedValue({
      id: 47,
      username: "friend47",
      first_name: "Friend",
      last_name: "User",
      profile_picture: "/media/friend47.png",
    });

    renderProfile("/profile/47");

    await waitFor(() => {
      expect(userService.getUser).toHaveBeenCalledWith("47");
    });
    expect(await screen.findByRole("heading", { name: "Friend User" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Friend User's profile" })).toBeInTheDocument();
  });

  it("shows an error when an invalid profile identifier is requested", async () => {
    userService.getUser.mockRejectedValue({
      response: { status: 404 },
    });

    renderProfile("/profile/99999999");

    expect(
      await screen.findByText("This profile could not be loaded.")
    ).toBeInTheDocument();
    expect(userService.getUser).toHaveBeenCalledWith("99999999");
  });
});
