import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AppErrorBoundary from "./AppErrorBoundary";

function BrokenPage() {
  throw new Error("render failed");
}

describe("AppErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a recovery screen instead of leaving a blank page", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <AppErrorBoundary>
        <BrokenPage />
      </AppErrorBoundary>
    );

    expect(screen.getByRole("heading", {
      name: "This page could not be displayed",
    })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload page" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to login" })).toHaveAttribute("href", "/login");
  });
});
