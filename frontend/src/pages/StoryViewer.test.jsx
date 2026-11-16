import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import storyService from "../services/storyService";
import messageService from "../services/messageService";
import useAuth from "../hooks/useAuth";
import StoryViewer from "./StoryViewer";

vi.mock("../services/storyService", () => ({
  default: {
    list: vi.fn(),
    markViewed: vi.fn(),
    toggleLike: vi.fn(),
    remove: vi.fn(),
    viewers: vi.fn(),
  },
}));

vi.mock("../services/messageService", () => ({
  default: {
    createConversation: vi.fn(),
    sendText: vi.fn(),
  },
}));

vi.mock("../hooks/useAuth", () => ({
  default: vi.fn(),
}));

describe("StoryViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: { id: 1 } });
    messageService.createConversation.mockResolvedValue({ id: 17 });
    messageService.sendText.mockResolvedValue({});
    storyService.markViewed.mockResolvedValue({});
    storyService.toggleLike.mockResolvedValue({
      is_liked: true,
      like_count: 1,
    });
    storyService.remove.mockResolvedValue({});
    storyService.viewers.mockResolvedValue({ results: [] });
    storyService.list.mockResolvedValue({
      results: [
        {
          id: 4,
          author: { id: 2, username: "author" },
          caption: "First story",
          media_type: null,
          is_seen: false,
          created_at: "2026-11-02T10:00:00Z",
        },
        {
          id: 5,
          author: { id: 2, username: "author" },
          caption: "Second story",
          media_type: null,
          is_seen: false,
          created_at: "2026-11-02T10:01:00Z",
        },
      ],
    });
  });

  it("shows story progress and moves to the next story", async () => {
    render(
      <MemoryRouter initialEntries={["/stories/4"]}>
        <Routes>
          <Route path="/stories/:id" element={<StoryViewer />} />
          <Route path="/" element={<p>Story viewer closed</p>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("First story")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Story 1 of 2" }))
      .toHaveAttribute("aria-valuenow", "0");

    fireEvent.click(screen.getByRole("button", { name: "Next story" }));

    expect(await screen.findByText("Second story")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Story 2 of 2" }))
      .toBeInTheDocument();
  });

  it("records views for other users' stories", async () => {
    render(
      <MemoryRouter initialEntries={["/stories/4"]}>
        <Routes>
          <Route path="/stories/:id" element={<StoryViewer />} />
          <Route path="/" element={<p>Story viewer closed</p>} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("First story");
    expect(storyService.markViewed).toHaveBeenCalledWith(4);
  });

  it("lets a viewer like and unlike a story", async () => {
    storyService.toggleLike
      .mockResolvedValueOnce({ is_liked: true, like_count: 1 })
      .mockResolvedValueOnce({ is_liked: false, like_count: 0 });
    render(
      <MemoryRouter initialEntries={["/stories/4"]}>
        <Routes>
          <Route path="/stories/:id" element={<StoryViewer />} />
          <Route path="/" element={<p>Story viewer closed</p>} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("First story");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Like story" }));
      await storyService.toggleLike.mock.results[0].value;
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Unlike story" }));
      await storyService.toggleLike.mock.results[1].value;
    });

    expect(storyService.toggleLike).toHaveBeenNthCalledWith(1, 4);
    expect(storyService.toggleLike).toHaveBeenNthCalledWith(2, 4);
  });

  it("sends a reply to the story author's direct conversation", async () => {
    render(
      <MemoryRouter initialEntries={["/stories/4"]}>
        <Routes>
          <Route path="/stories/:id" element={<StoryViewer />} />
          <Route path="/" element={<p>Story viewer closed</p>} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("First story");
    fireEvent.change(screen.getByRole("textbox", { name: "Reply to story..." }), {
      target: { value: "Nice update!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send story reply" }));

    await waitFor(() => {
      expect(messageService.createConversation).toHaveBeenCalledWith("author");
      expect(messageService.sendText).toHaveBeenCalledWith(
        17,
        "Story reply: Nice update!"
      );
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Reply sent.");
  });

  it("uses the story strip cache instead of fetching the list again", async () => {
    const stories = [
      {
        id: 4,
        author: { id: 2, username: "author" },
        caption: "Cached story",
        created_at: new Date().toISOString(),
      },
    ];

    render(
      <MemoryRouter
        initialEntries={[{ pathname: "/stories/4", state: { stories } }]}
      >
        <Routes>
          <Route path="/stories/:id" element={<StoryViewer />} />
          <Route path="/" element={<p>Story viewer closed</p>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Cached story")).toBeInTheDocument();
    expect(storyService.list).not.toHaveBeenCalled();
  });

  it("shows owner controls and removes a deleted story immediately", async () => {
    storyService.list.mockResolvedValue({
      results: [
        {
          id: 4,
          author: { id: 1, username: "owner" },
          caption: "My story",
          view_count: 1,
          created_at: "2026-11-02T10:00:00Z",
        },
      ],
    });
    storyService.viewers.mockResolvedValue({
      results: [
        {
          id: 2,
          username: "liker",
          is_liked: true,
          viewed_at: "2026-11-02T10:01:00Z",
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/stories/4"]}>
        <Routes>
          <Route path="/stories/:id" element={<StoryViewer />} />
          <Route path="/" element={<p>Story viewer closed</p>} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("My story");
    fireEvent.click(screen.getByRole("button", { name: "Seen by 1" }));
    expect(await screen.findByText("liker")).toBeInTheDocument();
    expect(screen.getByLabelText("Liked this story")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete story" }));
    expect(await screen.findByText("Story viewer closed")).toBeInTheDocument();
    expect(storyService.remove).toHaveBeenCalledWith(4);
  });

  it("uses video duration for progress and advances when playback ends", async () => {
    storyService.list.mockResolvedValue({
      results: [
        {
          id: 4,
          author: { id: 2, username: "author" },
          caption: "Video story",
          media_type: "video",
          media_url: "/video.mp4",
          is_seen: false,
          created_at: "2026-11-02T10:00:00Z",
        },
        {
          id: 5,
          author: { id: 2, username: "author" },
          caption: "Next story",
          media_type: null,
          is_seen: false,
          created_at: "2026-11-02T10:01:00Z",
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/stories/4"]}>
        <Routes>
          <Route path="/stories/:id" element={<StoryViewer />} />
          <Route path="/" element={<p>Story viewer closed</p>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Video story")).toBeInTheDocument();
    const video = document.querySelector("video");
    Object.defineProperty(video, "duration", { configurable: true, value: 10 });
    Object.defineProperty(video, "currentTime", { configurable: true, value: 5 });
    fireEvent.timeUpdate(video);

    expect(screen.getByRole("progressbar", { name: "Story 1 of 2" }))
      .toHaveAttribute("aria-valuenow", "50");

    fireEvent.ended(video);
    expect(await screen.findByText("Next story")).toBeInTheDocument();
  });

  it("automatically advances image stories after five seconds", async () => {
    vi.useFakeTimers();
    try {
      render(
        <MemoryRouter initialEntries={["/stories/4"]}>
          <Routes>
            <Route path="/stories/:id" element={<StoryViewer />} />
            <Route path="/" element={<p>Story viewer closed</p>} />
          </Routes>
        </MemoryRouter>
      );

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByText("First story")).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(5100);
      });

      expect(screen.getByText("Second story")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("pauses an image story when the viewer taps it", async () => {
    vi.useFakeTimers();
    storyService.list.mockResolvedValue({
      results: [
        {
          id: 4,
          author: { id: 2, username: "author" },
          image: "/story.jpg",
          media_type: "image",
          created_at: "2026-11-02T10:00:00Z",
        },
        {
          id: 5,
          author: { id: 2, username: "author" },
          caption: "Next story",
          media_type: null,
          created_at: "2026-11-02T10:01:00Z",
        },
      ],
    });
    try {
      render(
        <MemoryRouter initialEntries={["/stories/4"]}>
          <Routes>
            <Route path="/stories/:id" element={<StoryViewer />} />
            <Route path="/" element={<p>Story viewer closed</p>} />
          </Routes>
        </MemoryRouter>
      );
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      const progressBar = screen.getByRole("progressbar", { name: "Story 1 of 2" });
      expect(progressBar).toHaveAttribute("aria-valuenow", "20");

      fireEvent.click(screen.getByAltText("Story"));
      expect(document.querySelector(
        ".story-fullscreen-actions button[aria-label='Resume story']"
      )).toBeInTheDocument();
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });
      expect(progressBar).toHaveAttribute("aria-valuenow", "20");

      fireEvent.click(screen.getByAltText("Story"));
      await act(async () => {
        vi.advanceTimersByTime(4100);
      });
      expect(screen.getByText("Next story")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
