import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { API_URL } from "../../utils/constants";
import FriendCard from "./FriendCard";

describe("FriendCard", () => {
  it("links to the selected friend's profile using their API id", () => {
    const currentUserId = 12;
    const friend = {
      id: 47,
      username: "friend47",
      first_name: "Friend",
      last_name: "User",
      profile_picture: "/media/friend47.png",
    };

    render(
      <MemoryRouter>
        <FriendCard friend={friend} />
      </MemoryRouter>
    );

    const profileLink = screen.getByRole("link", { name: /friend user/i });

    expect(profileLink).toHaveAttribute("href", "/profile/47");
    expect(profileLink).not.toHaveAttribute("href", `/profile/${currentUserId}`);
    expect(screen.getByText("@friend47")).toBeInTheDocument();
    expect(profileLink.querySelector("img")).toHaveAttribute(
      "src",
      `${API_URL.replace("/api", "")}/media/friend47.png`
    );
  });
});
