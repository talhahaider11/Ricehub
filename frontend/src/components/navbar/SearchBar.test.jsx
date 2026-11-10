import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import SearchBar from "./SearchBar";

function CurrentLocation() {
  const location = useLocation();
  return <output aria-label="Current location">{location.pathname}{location.search}</output>;
}

describe("SearchBar", () => {
  it("keeps focus while typing and navigates when submitted", async () => {
    render(
      <MemoryRouter>
        <SearchBar />
        <CurrentLocation />
      </MemoryRouter>
    );

    const input = screen.getByRole("searchbox", { name: /users and posts/i });
    input.focus();
    fireEvent.change(input, {
      target: { value: "wheat" },
    });

    expect(screen.getByLabelText("Current location")).toHaveTextContent("/");
    expect(input).toHaveFocus();

    fireEvent.submit(input.closest("form"));
    await waitFor(() => expect(screen.getByLabelText("Current location"))
      .toHaveTextContent("/search?q=wheat"));
  });
});
