import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StoryStrip from "./StoryStrip";
import communityService from "../../services/communityService";

vi.mock("../../services/communityService", () => ({
  default: {
    stories: vi.fn(),
    createStory: vi.fn(),
    viewStory: vi.fn(),
  },
}));

describe("StoryStrip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    communityService.stories.mockResolvedValue({ results: [] });
  });

  it("opens the story composer and creates a text story", async () => {
    communityService.createStory.mockResolvedValue({
      id: 4,
      author: { id: 2, username: "story-user" },
      text: "A quick update",
      created_at: new Date().toISOString(),
    });
    const onComposerOpen = vi.fn();

    function StoryHarness() {
      const [open, setOpen] = useState(false);
      return (
        <StoryStrip
          currentUser={{ id: 2, username: "story-user" }}
          composerOpen={open}
          onComposerOpen={() => {
            setOpen(true);
            onComposerOpen();
          }}
          onComposerClose={() => setOpen(false)}
        />
      );
    }

    render(<StoryHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Create a story" }));
    expect(onComposerOpen).toHaveBeenCalled();

    fireEvent.change(await screen.findByRole("textbox", { name: "Story text" }), {
      target: { value: "A quick update" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Share story" }));

    await waitFor(() => {
      expect(communityService.createStory).toHaveBeenCalled();
    });
    expect(await screen.findByText("story-user")).toBeInTheDocument();
  });
});
