import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import SearchBar from "./SearchBar";

function CurrentLocation() {
  const location = useLocation();
  return <output aria-label="Current location">{location.pathname}{location.search}</output>;
}

describe("SearchBar", () => {
  it("opens the focused search view as the user types", async () => {
    render(
      <MemoryRouter>
        <SearchBar />
        <CurrentLocation />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByRole("searchbox", { name: /users and posts/i }), {
      target: { value: "wheat" },
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Current location")).toHaveTextContent(
        "/search?q=wheat"
      );
    });
  });
});
