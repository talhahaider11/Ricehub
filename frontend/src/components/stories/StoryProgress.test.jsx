import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import StoryProgress from "./StoryProgress";

describe("StoryProgress", () => {
  it("marks earlier stories complete and reports the active progress", () => {
    render(<StoryProgress count={3} currentIndex={1} progress={42} />);

    expect(screen.getByRole("progressbar", { name: "Story 1 of 3" }))
      .toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByRole("progressbar", { name: "Story 2 of 3" }))
      .toHaveAttribute("aria-valuenow", "42");
    expect(screen.getByRole("progressbar", { name: "Story 3 of 3" }))
      .toHaveAttribute("aria-valuenow", "0");
  });

  it("clamps progress to the valid range", () => {
    render(<StoryProgress count={1} currentIndex={0} progress={150} />);

    expect(screen.getByRole("progressbar", { name: "Story 1 of 1" }))
      .toHaveAttribute("aria-valuenow", "100");
  });
});
