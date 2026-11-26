import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import StoryAvatar from "./StoryAvatar";

describe("StoryAvatar", () => {
  it("falls back to the original story asset when the preview image fails", () => {
    const { container } = render(
      <StoryAvatar
        author={{ id: 2, username: "author" }}
        story={{
          id: 4,
          image: "https://cdn.example.test/stories/missing.webp",
          source_media_url: "https://cdn.example.test/media/original.webp",
          media_type: "image",
        }}
        hasUnseen
      />
    );

    const preview = container.querySelector(".story-card > img");
    expect(preview).toHaveAttribute(
      "src",
      "https://cdn.example.test/stories/missing.webp"
    );

    fireEvent.error(preview);

    expect(container.querySelector(".story-card > img")).toHaveAttribute(
      "src",
      "https://cdn.example.test/media/original.webp"
    );
  });
});
