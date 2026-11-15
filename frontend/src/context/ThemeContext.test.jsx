import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ThemeProvider, useTheme } from "./ThemeContext";

function ThemeTestControl() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button type="button" onClick={toggleTheme}>
      {theme}
    </button>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.dataset.theme = "";
    document.documentElement.classList.remove("dark");
  });

  it("persists and applies the selected theme to the root element", () => {
    localStorage.setItem("theme", "dark");
    render(
      <ThemeProvider>
        <ThemeTestControl />
      </ThemeProvider>
    );

    expect(screen.getByRole("button")).toHaveTextContent("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement).toHaveClass("dark");

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("button")).toHaveTextContent("light");
    expect(localStorage.getItem("theme")).toBe("light");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(document.documentElement).not.toHaveClass("dark");
  });
});
