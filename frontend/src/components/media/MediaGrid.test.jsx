import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import MediaGrid from "./MediaGrid";

describe("MediaGrid", () => {
  it("opens images in a navigable viewer", () => {
    render(
      <MediaGrid
        media={[
          {
            id: 1,
            media_type: "image",
            url: "https://cdn.example/one.jpg",
            original_filename: "one.jpg",
          },
          {
            id: 2,
            media_type: "image",
            url: "https://cdn.example/two.jpg",
            original_filename: "two.jpg",
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "View one.jpg" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      within(screen.getByRole("dialog")).getByRole("img", { name: "one.jpg" })
    ).toHaveAttribute(
      "src",
      "https://cdn.example/one.jpg"
    );

    fireEvent.click(screen.getByRole("button", { name: "Next image" }));
    expect(
      within(screen.getByRole("dialog")).getByRole("img", { name: "two.jpg" })
    ).toHaveAttribute(
      "src",
      "https://cdn.example/two.jpg"
    );
  });

  it("keeps pending videos playable using the original file", () => {
    render(
      <MediaGrid
        media={[
          {
            id: 3,
            media_type: "video",
            url: "https://cdn.example/original.mp4",
            processing_status: "pending",
          },
        ]}
      />
    );

    expect(screen.getByText(/processing pending/i)).toBeInTheDocument();
    expect(screen.getByText(/playing original/i)).toBeInTheDocument();
    expect(document.querySelector("video")).toHaveAttribute(
      "src",
      "https://cdn.example/original.mp4"
    );
  });

  it("renders every attachment when a post has more than four files", () => {
    render(
      <MediaGrid
        media={Array.from({ length: 6 }, (_, index) => ({
          id: index + 10,
          media_type: "video",
          url: `https://cdn.example/${index}.mp4`,
          processing_status: "ready",
        }))}
      />
    );

    expect(document.querySelectorAll("video")).toHaveLength(6);
  });
});
