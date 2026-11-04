import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getMediaAsset } from "../../services/mediaService";
import storyService from "../../services/storyService";
import StoryUploader from "./StoryUploader";

vi.mock("../../services/mediaService", () => ({
  getMediaAsset: vi.fn(),
}));

vi.mock("../../services/storyService", () => ({
  default: {
    createStory: vi.fn(),
  },
}));

vi.mock("../media/MediaUploader", () => ({
  default: function MediaUploaderMock({ onUploaded }) {
    return (
      <>
        <button
          type="button"
          onClick={() =>
          onUploaded([
            {
              id: 17,
              media_type: "image",
              processing_status: "ready",
              original_filename: "photo.png",
            },
          ])
          }
        >
          Add test media
        </button>
        <button
          type="button"
          onClick={() =>
            onUploaded([
              {
                id: 18,
                media_type: "video",
                processing_status: "pending",
                original_filename: "clip.mp4",
              },
            ])
          }
        >
          Add pending video
        </button>
      </>
    );
  },
}));

describe("StoryUploader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storyService.createStory.mockResolvedValue({ id: 1 });
    getMediaAsset.mockResolvedValue({
      id: 18,
      media_type: "video",
      processing_status: "ready",
    });
  });

  it("uses a ready media asset and selected visibility when creating a story", async () => {
    const onCreated = vi.fn();
    render(<StoryUploader onCreated={onCreated} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Story text" }), {
      target: { value: "A caption" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Story visibility" }), {
      target: { value: "public" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add test media" }));
    fireEvent.click(screen.getByRole("button", { name: "Share story" }));

    await waitFor(() => {
      expect(storyService.createStory).toHaveBeenCalledWith(
        17,
        "public",
        "A caption"
      );
    });
    expect(onCreated).toHaveBeenCalledOnce();
  });

  it("allows text-only stories", async () => {
    render(<StoryUploader />);
    fireEvent.change(screen.getByRole("textbox", { name: "Story text" }), {
      target: { value: "A text story" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Share story" }));

    await waitFor(() => {
      expect(storyService.createStory).toHaveBeenCalledWith(
        undefined,
        "friends",
        "A text story"
      );
    });
  });

  it("waits for video processing before creating the story", async () => {
    render(<StoryUploader />);
    fireEvent.click(screen.getByRole("button", { name: "Add pending video" }));
    fireEvent.click(screen.getByRole("button", { name: "Share story" }));

    await waitFor(() => {
      expect(getMediaAsset).toHaveBeenCalledWith(18);
      expect(storyService.createStory).toHaveBeenCalledWith(
        18,
        "friends",
        ""
      );
    });
  });
});
