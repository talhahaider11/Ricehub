import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

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

function HomeCacheProbe() {
  const location = useLocation();
  return <p>Home story cache: {location.state?.stories?.length || 0}</p>;
}

let pauseSpy;

describe("StoryViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    pauseSpy = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
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

  afterEach(() => {
    vi.restoreAllMocks();
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

  it("navigates to the story author's profile and stops video playback", async () => {
    storyService.list.mockResolvedValue({
      results: [
        {
          id: 4,
          author: { id: 2, username: "author" },
          caption: "Video story",
          media_type: "video",
          media_url: "/video.mp4",
          created_at: "2026-11-02T10:00:00Z",
        },
      ],
    });
    render(
      <MemoryRouter initialEntries={["/stories/4"]}>
        <Routes>
          <Route path="/stories/:id" element={<StoryViewer />} />
          <Route path="/profile/:id" element={<p>Author profile</p>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("link", {
      name: "View author's profile",
    }));

    expect(await screen.findByText("Author profile")).toBeInTheDocument();
    expect(pauseSpy).toHaveBeenCalled();
    expect(document.querySelector(".story-fullscreen")).toBeNull();
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
    fireEvent.change(screen.getByPlaceholderText("Reply"), {
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

  it("returns active stories to Home so the strip can render without waiting", async () => {
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
          <Route path="/" element={<HomeCacheProbe />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Cached story")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close story" }));

    expect(await screen.findByText("Home story cache: 1")).toBeInTheDocument();
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
    const topActions = document.querySelector(".story-fullscreen-top-actions");
    expect(within(topActions).getByRole("button", { name: "Pause story" }))
      .toBeInTheDocument();
    expect(within(topActions).getByRole("button", { name: "Close story" }))
      .toBeInTheDocument();
    expect(within(topActions).queryByRole("button", { name: /Seen by|Delete story/ }))
      .not.toBeInTheDocument();
    expect(document.querySelector(".story-owner-footer")).toBeInTheDocument();
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
    expect(video).not.toHaveAttribute("controls");
    expect(video).toHaveAttribute("autoplay");
    expect(video).toHaveAttribute("controlslist", "nodownload noplaybackrate");
    expect(video).toHaveAttribute("disablepictureinpicture");
    expect(document.querySelector(".story-paused-indicator")).toBeNull();
    Object.defineProperty(video, "duration", { configurable: true, value: 10 });
    Object.defineProperty(video, "currentTime", { configurable: true, value: 5 });
    fireEvent.timeUpdate(video);

    expect(screen.getByRole("progressbar", { name: "Story 1 of 2" }))
      .toHaveAttribute("aria-valuenow", "50");

    fireEvent.ended(video);
    expect(await screen.findByText("Next story")).toBeInTheDocument();
  });

  it("retries blocked video autoplay muted and offers an unmute action", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play")
      .mockReset()
      .mockRejectedValueOnce(new Error("Autoplay blocked"))
      .mockResolvedValue(undefined);
    storyService.list.mockResolvedValue({
      results: [
        {
          id: 4,
          author: { id: 2, username: "author" },
          media_type: "video",
          media_url: "/video.mp4",
          created_at: "2026-11-02T10:00:00Z",
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

    const unmuteButton = await screen.findByRole("button", { name: "Tap to unmute" });
    expect(document.querySelector("video").muted).toBe(true);
    fireEvent.click(unmuteButton);
    await waitFor(() => expect(document.querySelector("video").muted).toBe(false));
    expect(screen.queryByRole("button", { name: "Tap to unmute" }))
      .not.toBeInTheDocument();
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
      const topActions = document.querySelector(".story-fullscreen-top-actions");
      const resumeButton = within(topActions).getByRole("button", {
        name: "Resume story",
      });
      expect(resumeButton).toBeInTheDocument();
      expect(resumeButton.parentElement).toHaveClass("story-fullscreen-top-actions");
      expect(screen.getByRole("button", { name: "Close story" }).parentElement)
        .toBe(resumeButton.parentElement);
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

  it("falls back to the story thumbnail when the original image cannot load", async () => {
    storyService.list.mockResolvedValue({
      results: [
        {
          id: 4,
          author: { id: 2, username: "author" },
          image: "https://cdn.example.test/stories/missing.webp",
          media_url: "https://cdn.example.test/stories/missing.webp",
          source_media_url: "https://cdn.example.test/media/original.jpg",
          thumbnail_url: "https://cdn.example.test/media/thumbnails/story.jpg",
          media_type: "image",
          created_at: new Date().toISOString(),
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

    const image = await screen.findByAltText("Story");
    expect(image).toHaveAttribute(
      "src",
      "https://cdn.example.test/stories/missing.webp"
    );

    fireEvent.error(image);

    expect(screen.getByAltText("Story")).toHaveAttribute(
      "src",
      "https://cdn.example.test/media/original.jpg"
    );

    fireEvent.error(screen.getByAltText("Story"));

    expect(screen.getByAltText("Story")).toHaveAttribute(
      "src",
      "https://cdn.example.test/media/thumbnails/story.jpg"
    );
  });

  it("falls back to the original story asset when a video URL fails", async () => {
    storyService.list.mockResolvedValue({
      results: [
        {
          id: 4,
          author: { id: 2, username: "author" },
          video: "https://cdn.example.test/stories/missing.mp4",
          media_url: "https://cdn.example.test/stories/missing.mp4",
          source_media_url: "https://cdn.example.test/media/original.mp4",
          media_type: "video",
          created_at: new Date().toISOString(),
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

    await waitFor(() => {
      expect(document.querySelector(".story-media-stage video")).toBeInTheDocument();
    });
    const videoElement = document.querySelector(".story-media-stage video");
    expect(videoElement).toHaveAttribute(
      "src",
      "https://cdn.example.test/stories/missing.mp4"
    );

    fireEvent.error(videoElement);

    expect(document.querySelector(".story-media-stage video")).toHaveAttribute(
      "src",
      "https://cdn.example.test/media/original.mp4"
    );
  });
});
