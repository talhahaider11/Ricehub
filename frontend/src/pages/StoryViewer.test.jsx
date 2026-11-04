import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import storyService from "../services/storyService";
import useAuth from "../hooks/useAuth";
import StoryViewer from "./StoryViewer";

vi.mock("../services/storyService", () => ({
  default: {
    list: vi.fn(),
    markViewed: vi.fn(),
  },
}));

vi.mock("../hooks/useAuth", () => ({
  default: vi.fn(),
}));

describe("StoryViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: { id: 1 } });
    storyService.markViewed.mockResolvedValue({});
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
});
