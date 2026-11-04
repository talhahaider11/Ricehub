import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import StoryStrip from "./StoryStrip";
import storyService from "../../services/storyService";

vi.mock("../../services/storyService", () => ({
  default: {
    list: vi.fn(),
    markViewed: vi.fn(),
  },
}));

function StoryRouteProbe() {
  const { id } = useParams();
  return <p>Story route {id}</p>;
}

describe("StoryStrip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storyService.list.mockResolvedValue({ results: [] });
    storyService.markViewed.mockResolvedValue({});
  });

  it("navigates to the story composer", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="/"
            element={
              <StoryStrip
                currentUser={{ id: 2, username: "story-user" }}
                showCreate
              />
            }
          />
          <Route path="/create" element={<p>Create story page</p>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Create a story" }));

    expect(await screen.findByText("Create story page")).toBeInTheDocument();
  });

  it("shows story authors and opens the selected story", async () => {
    storyService.list.mockResolvedValue({
      results: [
        {
          id: 4,
          author: {
            id: 7,
            username: "story-user",
            profile_picture: null,
          },
          caption: "A quick update",
          is_seen: false,
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<StoryStrip />} />
          <Route path="/stories/:id" element={<StoryRouteProbe />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "View story-user's story" })
    );

    expect(await screen.findByText("Story route 4")).toBeInTheDocument();
  });

  it("groups stories by author and opens the first unseen story", async () => {
    storyService.list.mockResolvedValue({
      results: [
        {
          id: 8,
          author: { id: 7, username: "story-user" },
          is_seen: true,
        },
        {
          id: 9,
          author: { id: 7, username: "story-user" },
          is_seen: false,
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<StoryStrip />} />
          <Route path="/stories/:id" element={<StoryRouteProbe />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "View story-user's story" })
    );

    expect(await screen.findByText("Story route 9")).toBeInTheDocument();
  });
});
